/**
 * ValueCommitmentTrackingService
 *
 * All write operations (create, update, status transitions, delete) route
 * through the backend API at /api/v1/value-commitments. The backend owns
 * authorization, tenant resolution, FSM enforcement, and audit logging.
 *
 * The frontend is intentionally "dumb" here: it sends a command and reacts
 * to the typed response or error — it does not derive tenant context, enforce
 * business rules, or write to Supabase directly.
 *
 * Feature flag: VITE_USE_BACKEND_COMMITMENT_API
 *   "true"  (default) — all writes go through the backend API
 *   "false" — emergency rollback path; stubs return mock data
 *
 * Read operations (getCommitment, calculateProgress, etc.) are stubs pending
 * dedicated GET endpoints; they return mock data in both flag states.
 */

import { logger } from "../lib/logger";
import { apiClient } from "../api/client/unified-api-client";
import type {
  CommitmentDto,
  NoteDto,
  CreateCommitmentRequest,
  UpdateCommitmentRequest,
  StatusTransitionRequest,
  AddNoteRequest,
  CommitmentDashboard,
  CommitmentProgress,
  CommitmentStakeholder,
  CommitmentMilestone,
  CommitmentMetric,
  CommitmentRisk,
  ValueCommitment,
} from "../types/value-commitment-tracking.js";

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

function useBackendApi(): boolean {
  const flag = import.meta.env.VITE_USE_BACKEND_COMMITMENT_API;
  // Default ON — only the explicit string "false" disables it
  return flag !== "false";
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class CommitmentApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommitmentApiError";
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "The request contained invalid data. Please check your inputs.",
  403: "You do not have permission to perform this action.",
  404: "The commitment could not be found.",
  409: "This action conflicts with the current state of the commitment.",
  500: "An unexpected error occurred. Please try again.",
};

/**
 * Unwrap an ApiResponse, throwing CommitmentApiError on failure.
 * Callers (hooks, components) catch this and map it to a toast/error state.
 *
 * apiClient embeds the HTTP status in error.message as "HTTP 4xx: <text>".
 * We parse it out so CommitmentApiError.status reflects the real HTTP code.
 */
function parseHttpStatus(message: string | undefined): number {
  if (!message) return 500;
  const match = message.match(/HTTP (\d{3})/);
  return match ? parseInt(match[1], 10) : 500;
}

function unwrap<T>(
  response: { success: boolean; data?: T; error?: { code: string; message: string } },
): T {
  // Use `!= null` (not `!== undefined`) so that a valid `null` body from the
  // server is returned rather than treated as an error (Fix 5).
  if (response.success && response.data != null) {
    return response.data;
  }
  const status = parseHttpStatus(response.error?.message);
  const code = response.error?.code ?? "UNKNOWN_ERROR";
  const message = STATUS_MESSAGES[status] ?? response.error?.message ?? "An unexpected error occurred.";
  throw new CommitmentApiError(status, code, message);
}

/**
 * Unwrap a void response (e.g. HTTP 204 DELETE).
 * `unwrap` requires `data != null`, which is never true for a no-body response.
 * This variant only inspects `success` (Fix 1).
 */
function unwrapVoid(
  response: { success: boolean; error?: { code: string; message: string } },
): void {
  if (response.success) return;
  const status = parseHttpStatus(response.error?.message);
  const code = response.error?.code ?? "UNKNOWN_ERROR";
  const message = STATUS_MESSAGES[status] ?? response.error?.message ?? "An unexpected error occurred.";
  throw new CommitmentApiError(status, code, message);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ValueCommitmentTrackingService {
  private readonly base = "/api/v1/value-commitments";

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async createCommitment(
    _tenantId: string,
    _userId: string,
    _sessionId: string,
    data: CreateCommitmentRequest,
  ): Promise<CommitmentDto> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return this.stubCommitment(data.title);
    }

    logger.info("Creating commitment via backend API", { title: data.title });

    // Strip any accidental tenant fields the caller may have included
    const safeData = { ...data } as Record<string, unknown>;
    delete safeData["tenant_id"];
    delete safeData["organization_id"];

    const response = await apiClient.post<CommitmentDto>(this.base, safeData);
    return unwrap(response);
  }

  // -------------------------------------------------------------------------
  // Update core fields
  // -------------------------------------------------------------------------

  async updateCommitment(
    commitmentId: string,
    _tenantId: string,
    _userId: string,
    updates: UpdateCommitmentRequest,
  ): Promise<CommitmentDto> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return this.stubCommitment(updates.title ?? "");
    }

    logger.info("Updating commitment via backend API", { commitmentId });

    const safeUpdates = { ...updates } as Record<string, unknown>;
    delete safeUpdates["tenant_id"];
    delete safeUpdates["organization_id"];

    const response = await apiClient.patch<CommitmentDto>(
      `${this.base}/${commitmentId}`,
      safeUpdates,
    );
    return unwrap(response);
  }

  // -------------------------------------------------------------------------
  // Status transition (replaces the old direct-Supabase updateCommitmentStatus)
  // -------------------------------------------------------------------------

  async updateCommitmentStatus(
    commitmentId: string,
    _tenantId: string,
    _userId: string,
    status: StatusTransitionRequest["status"],
    progressPercentage?: number,
    reason?: string,
  ): Promise<CommitmentDto> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return this.stubCommitment("", status);
    }

    logger.info("Transitioning commitment status via backend API", { commitmentId, status });

    const body: StatusTransitionRequest = { status };
    if (progressPercentage !== undefined) body.progress_percentage = progressPercentage;
    if (reason) body.reason = reason;

    const response = await apiClient.post<CommitmentDto>(
      `${this.base}/${commitmentId}/status-transitions`,
      body,
    );
    return unwrap(response);
  }

  // -------------------------------------------------------------------------
  // Add note
  // -------------------------------------------------------------------------

  async addNote(
    commitmentId: string,
    _tenantId: string,
    _userId: string,
    note: AddNoteRequest,
  ): Promise<NoteDto> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return {
        id: "stub",
        commitment_id: commitmentId,
        body: note.body,
        visibility: note.visibility ?? "internal",
        created_by: "stub",
        created_at: new Date().toISOString(),
      };
    }

    logger.info("Adding note via backend API", { commitmentId });

    const response = await apiClient.post<NoteDto>(
      `${this.base}/${commitmentId}/notes`,
      note,
    );
    return unwrap(response);
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  async deleteCommitment(
    commitmentId: string,
    _tenantId: string,
    _userId: string,
  ): Promise<void> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, no-op");
      return;
    }

    logger.info("Deleting commitment via backend API", { commitmentId });

    const response = await apiClient.delete(`${this.base}/${commitmentId}`);
    unwrapVoid(response);
  }

  // -------------------------------------------------------------------------
  // Read — proxies to backend GET; falls back to null on error
  // -------------------------------------------------------------------------

  async getCommitment(commitmentId: string, _tenantId: string): Promise<CommitmentDashboard | null> {
    try {
      const response = await apiClient.get<CommitmentDto>(`${this.base}/${commitmentId}`);
      if (!response.success || !response.data) return null;
      return this.dtoToDashboard(response.data);
    } catch (error) {
      logger.error("Failed to get commitment", { error, commitmentId });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Stub methods — not yet migrated; preserve call-site interface
  // -------------------------------------------------------------------------

  async addStakeholder(
    _commitmentId: string,
    _tenantId: string,
    _userId: string,
    _data: Partial<CommitmentStakeholder>,
  ): Promise<CommitmentStakeholder> {
    logger.warn("addStakeholder: not yet migrated to backend API");
    return {} as CommitmentStakeholder;
  }

  async updateStakeholder(
    _stakeholderId: string,
    _tenantId: string,
    _userId: string,
    _updates: Partial<CommitmentStakeholder>,
  ): Promise<CommitmentStakeholder> {
    logger.warn("updateStakeholder: not yet migrated to backend API");
    return {} as CommitmentStakeholder;
  }

  async createMilestone(
    _commitmentId: string,
    _tenantId: string,
    _userId: string,
    _data: Partial<CommitmentMilestone>,
  ): Promise<CommitmentMilestone> {
    logger.warn("createMilestone: not yet migrated to backend API");
    return {} as CommitmentMilestone;
  }

  async updateMilestoneProgress(
    _milestoneId: string,
    _tenantId: string,
    _userId: string,
    _progressPercentage: number,
    _status?: CommitmentMilestone["status"],
    _actualDate?: string,
  ): Promise<CommitmentMilestone> {
    logger.warn("updateMilestoneProgress: not yet migrated to backend API");
    return {} as CommitmentMilestone;
  }

  async createMetric(
    _commitmentId: string,
    _tenantId: string,
    _userId: string,
    _data: Partial<CommitmentMetric>,
  ): Promise<CommitmentMetric> {
    logger.warn("createMetric: not yet migrated to backend API");
    return {} as CommitmentMetric;
  }

  async updateMetricValue(
    _metricId: string,
    _tenantId: string,
    _userId: string,
    _currentValue: number,
    _lastMeasuredAt?: string,
  ): Promise<CommitmentMetric> {
    logger.warn("updateMetricValue: not yet migrated to backend API");
    return {} as CommitmentMetric;
  }

  async createRisk(
    _commitmentId: string,
    _tenantId: string,
    _userId: string,
    _data: Partial<CommitmentRisk>,
  ): Promise<CommitmentRisk> {
    logger.warn("createRisk: not yet migrated to backend API");
    return {} as CommitmentRisk;
  }

  async updateRiskStatus(
    _riskId: string,
    _tenantId: string,
    _userId: string,
    _status: CommitmentRisk["status"],
    _mitigatedAt?: string,
  ): Promise<CommitmentRisk> {
    logger.warn("updateRiskStatus: not yet migrated to backend API");
    return {} as CommitmentRisk;
  }

  async calculateProgress(
    commitmentId: string,
    _tenantId: string,
  ): Promise<CommitmentProgress> {
    return {
      commitment_id:        commitmentId,
      overall_progress:     0,
      milestone_completion: 0,
      metric_achievement:   0,
      risk_level:           "low",
      days_remaining:       0,
      is_on_track:          false,
    };
  }

  async getAtRiskCommitments(_tenantId: string): Promise<ValueCommitment[]> {
    return [];
  }

  async validateAgainstGroundTruth(
    _commitmentId: string,
    _tenantId: string,
  ): Promise<{ isValid: boolean; confidence: number; issues: string[]; recommendations: string[] }> {
    return { isValid: true, confidence: 0, issues: [], recommendations: [] };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private stubCommitment(title: string, status: CommitmentDto["status"] = "draft"): CommitmentDto {
    const now = new Date().toISOString();
    return {
      id:                     `stub-${Date.now()}`,
      organization_id:        "",
      title,
      description:            null,
      commitment_type:        "strategic",
      priority:               "medium",
      owner_user_id:          null,
      status,
      progress_percentage:    0,
      target_completion_date: now,
      timeframe_months:       12,
      financial_impact:       null,
      currency:               "USD",
      tags:                   [],
      created_by:             "",
      created_at:             now,
      updated_at:             now,
    };
  }

  private dtoToDashboard(dto: CommitmentDto): CommitmentDashboard {
    // Map the backend DTO to the legacy CommitmentDashboard shape so existing
    // UI components that consume getCommitment() continue to work unchanged.
    const commitment: ValueCommitment = {
      id:                      dto.id,
      tenant_id:               "",
      user_id:                 dto.created_by,
      session_id:              "",
      organization_id:         dto.organization_id,
      title:                   dto.title,
      description:             dto.description ?? "",
      commitment_type:         dto.commitment_type,
      priority:                dto.priority,
      financial_impact:        (dto.financial_impact as ValueCommitment["financial_impact"]) ?? {},
      currency:                dto.currency,
      timeframe_months:        dto.timeframe_months,
      status:                  dto.status as ValueCommitment["status"],
      progress_percentage:     dto.progress_percentage,
      confidence_level:        0,
      committed_at:            dto.created_at,
      target_completion_date:  dto.target_completion_date,
      actual_completion_date:  null,
      ground_truth_references: {},
      tags:                    dto.tags,
      metadata:                {},
      created_at:              dto.created_at,
      updated_at:              dto.updated_at,
    };

    return {
      commitment,
      stakeholders: [],
      milestones:   [],
      metrics:      [],
      risks:        [],
      progress: {
        commitment_id:        dto.id,
        overall_progress:     dto.progress_percentage,
        milestone_completion: 0,
        metric_achievement:   0,
        risk_level:           "low",
        days_remaining:       0,
        is_on_track:          dto.status === "active",
      },
      recent_audits: [],
    };
  }
}

export const valueCommitmentTrackingService = new ValueCommitmentTrackingService();
