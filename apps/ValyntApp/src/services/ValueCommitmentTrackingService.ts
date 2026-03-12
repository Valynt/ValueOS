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
  AddMilestoneRequest,
  UpdateMilestoneRequest,
  AddMetricRequest,
  UpdateMetricActualRequest,
  AddRiskRequest,
  UpdateRiskRequest,
  AddStakeholderRequest,
  UpdateStakeholderRequest,
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
  // Milestones
  // -------------------------------------------------------------------------

  async createMilestone(
    commitmentId: string,
    _tenantId: string,
    _userId: string,
    data: AddMilestoneRequest,
  ): Promise<CommitmentMilestone> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return {} as CommitmentMilestone;
    }

    const response = await apiClient.post<CommitmentMilestone>(
      `${this.base}/${commitmentId}/milestones`,
      data,
    );
    return unwrap(response);
  }

  /** @deprecated Use updateMilestone(commitmentId, milestoneId, updates) instead. */
  async updateMilestoneProgress(
    _milestoneId: string,
    _tenantId: string,
    _userId: string,
    _progressPercentage: number,
    _status?: CommitmentMilestone["status"],
    _actualDate?: string,
  ): Promise<CommitmentMilestone> {
    throw new Error(
      "updateMilestoneProgress is deprecated. Use updateMilestone(commitmentId, milestoneId, updates) instead.",
    );
  }

  async updateMilestone(
    commitmentId: string,
    milestoneId: string,
    updates: UpdateMilestoneRequest,
  ): Promise<CommitmentMilestone> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return {} as CommitmentMilestone;
    }

    const response = await apiClient.patch<CommitmentMilestone>(
      `${this.base}/${commitmentId}/milestones/${milestoneId}`,
      updates,
    );
    return unwrap(response);
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  async createMetric(
    commitmentId: string,
    _tenantId: string,
    _userId: string,
    data: AddMetricRequest,
  ): Promise<CommitmentMetric> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return {} as CommitmentMetric;
    }

    const response = await apiClient.post<CommitmentMetric>(
      `${this.base}/${commitmentId}/metrics`,
      data,
    );
    return unwrap(response);
  }

  /** @deprecated Use updateMetricActual(commitmentId, metricId, currentValue) instead. */
  async updateMetricValue(
    _metricId: string,
    _tenantId: string,
    _userId: string,
    _currentValue: number,
  ): Promise<CommitmentMetric> {
    throw new Error(
      "updateMetricValue is deprecated. Use updateMetricActual(commitmentId, metricId, currentValue) instead.",
    );
  }

  async updateMetricActual(
    commitmentId: string,
    metricId: string,
    currentValue: number,
  ): Promise<CommitmentMetric> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return {} as CommitmentMetric;
    }

    const response = await apiClient.patch<CommitmentMetric>(
      `${this.base}/${commitmentId}/metrics/${metricId}/actual`,
      { current_value: currentValue } satisfies UpdateMetricActualRequest,
    );
    return unwrap(response);
  }

  // -------------------------------------------------------------------------
  // Risks
  // -------------------------------------------------------------------------

  async createRisk(
    commitmentId: string,
    _tenantId: string,
    _userId: string,
    data: AddRiskRequest,
  ): Promise<CommitmentRisk> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return {} as CommitmentRisk;
    }

    const response = await apiClient.post<CommitmentRisk>(
      `${this.base}/${commitmentId}/risks`,
      data,
    );
    return unwrap(response);
  }

  /** @deprecated Use updateRisk(commitmentId, riskId, updates) instead. */
  async updateRiskStatus(
    _riskId: string,
    _tenantId: string,
    _userId: string,
    _status: CommitmentRisk["status"],
    _mitigatedAt?: string,
  ): Promise<CommitmentRisk> {
    throw new Error(
      "updateRiskStatus is deprecated. Use updateRisk(commitmentId, riskId, updates) instead.",
    );
  }

  async updateRisk(
    commitmentId: string,
    riskId: string,
    updates: UpdateRiskRequest,
  ): Promise<CommitmentRisk> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return {} as CommitmentRisk;
    }

    const response = await apiClient.patch<CommitmentRisk>(
      `${this.base}/${commitmentId}/risks/${riskId}`,
      updates,
    );
    return unwrap(response);
  }

  // -------------------------------------------------------------------------
  // Stakeholders
  // -------------------------------------------------------------------------

  async addStakeholder(
    commitmentId: string,
    _tenantId: string,
    _userId: string,
    data: AddStakeholderRequest,
  ): Promise<CommitmentStakeholder> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return {} as CommitmentStakeholder;
    }

    const response = await apiClient.post<CommitmentStakeholder>(
      `${this.base}/${commitmentId}/stakeholders`,
      data,
    );
    return unwrap(response);
  }

  /** @deprecated Use updateStakeholderForCommitment(commitmentId, stakeholderId, updates) instead. */
  async updateStakeholder(
    _stakeholderId: string,
    _tenantId: string,
    _userId: string,
    _updates: UpdateStakeholderRequest,
  ): Promise<CommitmentStakeholder> {
    throw new Error(
      "updateStakeholder is deprecated. Use updateStakeholderForCommitment(commitmentId, stakeholderId, updates) instead.",
    );
  }

  async updateStakeholderForCommitment(
    commitmentId: string,
    stakeholderId: string,
    updates: UpdateStakeholderRequest,
  ): Promise<CommitmentStakeholder> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, returning stub");
      return {} as CommitmentStakeholder;
    }

    const response = await apiClient.patch<CommitmentStakeholder>(
      `${this.base}/${commitmentId}/stakeholders/${stakeholderId}`,
      updates,
    );
    return unwrap(response);
  }

  // -------------------------------------------------------------------------
  // Progress and at-risk reads
  // -------------------------------------------------------------------------

  async calculateProgress(
    commitmentId: string,
    _tenantId: string,
  ): Promise<CommitmentProgress> {
    if (!useBackendApi()) {
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

    try {
      const response = await apiClient.get<CommitmentProgress>(
        `${this.base}/${commitmentId}/progress`,
      );
      if (!response.success || !response.data) {
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
      return response.data;
    } catch (error) {
      logger.error("calculateProgress failed", { error, commitmentId });
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
  }

  async getAtRiskCommitments(_tenantId: string): Promise<ValueCommitment[]> {
    if (!useBackendApi()) {
      return [];
    }

    try {
      const response = await apiClient.get<CommitmentDto[]>(
        `${this.base}?atRisk=true`,
      );
      if (!response.success || !response.data) return [];
      // Map CommitmentDto → ValueCommitment for backward compatibility
      return response.data.map((dto) => this.dtoToValueCommitment(dto));
    } catch (error) {
      logger.error("getAtRiskCommitments failed", { error });
      return [];
    }
  }

  async validateAgainstGroundTruth(
    commitmentId: string,
    _tenantId: string,
  ): Promise<{ isValid: boolean; confidence: number; issues: string[]; recommendations: string[] }> {
    if (!useBackendApi()) {
      logger.warn("ValueCommitmentTrackingService: backend API disabled, validation unavailable");
      return {
        isValid:         false,
        confidence:      0,
        issues:          ["Validation is unavailable while the backend API is disabled"],
        recommendations: ["Re-enable the backend API to perform ground-truth validation"],
      };
    }

    try {
      const response = await apiClient.post<{
        isValid: boolean;
        confidence: number;
        issues: string[];
        recommendations: string[];
      }>(`${this.base}/${commitmentId}/validate-progress`, {});

      if (!response.success || !response.data) {
        throw new CommitmentApiError(500, "VALIDATION_FAILED", "Validation endpoint returned no data");
      }
      return response.data;
    } catch (err) {
      if (err instanceof CommitmentApiError) throw err;
      logger.error("validateAgainstGroundTruth failed", { error: err, commitmentId });
      throw new CommitmentApiError(500, "VALIDATION_FAILED", "Ground-truth validation is unavailable");
    }
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

  private dtoToValueCommitment(dto: CommitmentDto): ValueCommitment {
    return {
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
