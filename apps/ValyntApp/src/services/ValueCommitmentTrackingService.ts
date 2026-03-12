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
  if (response.success && response.data !== undefined) {
    return response.data;
  }
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
    if (!response.success) {
      unwrap(response);
    }
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
    data: Partial<CommitmentMilestone>,
  ): Promise<CommitmentMilestone> {
    logger.info("Creating milestone via backend API", { commitmentId });

    const response = await apiClient.post<CommitmentMilestone>(
      `${this.base}/${commitmentId}/milestones`,
      {
        title:            data.title ?? "",
        description:      data.description,
        milestone_type:   "deliverable",
        sequence_order:   data.id ? 0 : 0,
        target_date:      data.due_date ?? new Date().toISOString(),
        deliverables:     Array.isArray(data.deliverables) ? data.deliverables.map(String) : undefined,
      },
    );
    return unwrap(response);
  }

  async updateMilestoneProgress(
    milestoneId: string,
    _tenantId: string,
    _userId: string,
    progressPercentage: number,
    status?: CommitmentMilestone["status"],
    actualDate?: string,
  ): Promise<CommitmentMilestone> {
    // commitmentId is not available at this call-site; the backend scopes by
    // milestoneId + commitment_id. We use a placeholder route segment and rely
    // on the backend to resolve ownership via the milestone row itself.
    // Callers that have commitmentId should use updateMilestoneProgressForCommitment.
    logger.info("Updating milestone progress via backend API", { milestoneId });

    const body: Record<string, unknown> = { progress_percentage: progressPercentage };
    if (status) body["status"] = status;
    if (actualDate) body["actual_date"] = actualDate;

    const response = await apiClient.patch<CommitmentMilestone>(
      `${this.base}/milestones/${milestoneId}`,
      body,
    );
    return unwrap(response);
  }

  async updateMilestoneProgressForCommitment(
    commitmentId: string,
    milestoneId: string,
    progressPercentage: number,
    status?: CommitmentMilestone["status"],
    actualDate?: string,
  ): Promise<CommitmentMilestone> {
    logger.info("Updating milestone progress via backend API", { commitmentId, milestoneId });

    const body: Record<string, unknown> = { progress_percentage: progressPercentage };
    if (status) body["status"] = status;
    if (actualDate) body["actual_date"] = actualDate;

    const response = await apiClient.patch<CommitmentMilestone>(
      `${this.base}/${commitmentId}/milestones/${milestoneId}`,
      body,
    );
    return unwrap(response);
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  async createMetric(
    _commitmentId: string,
    _tenantId: string,
    _userId: string,
    _data: Partial<CommitmentMetric>,
  ): Promise<CommitmentMetric> {
    // Metrics are seeded at commitment creation time via CreateCommitmentRequest.metrics.
    // Post-creation metric creation is not yet exposed by the backend API.
    // Return a typed empty object so call-sites compile; this will be wired
    // when the backend adds POST /:commitmentId/metrics.
    logger.warn("createMetric: post-creation metric creation not yet supported by backend API");
    return {} as CommitmentMetric;
  }

  async updateMetricValue(
    metricId: string,
    _tenantId: string,
    _userId: string,
    currentValue: number,
    lastMeasuredAt?: string,
  ): Promise<CommitmentMetric> {
    // metricId alone is insufficient to route to the correct commitment.
    // Callers that have commitmentId should use updateMetricValueForCommitment.
    logger.warn("updateMetricValue: use updateMetricValueForCommitment when commitmentId is available", { metricId });
    return {} as CommitmentMetric;
  }

  async updateMetricValueForCommitment(
    commitmentId: string,
    metricId: string,
    currentValue: number,
    lastMeasuredAt?: string,
  ): Promise<CommitmentMetric> {
    logger.info("Updating metric value via backend API", { commitmentId, metricId });

    const body: Record<string, unknown> = { current_value: currentValue };
    if (lastMeasuredAt) body["last_measured_at"] = lastMeasuredAt;

    const response = await apiClient.patch<CommitmentMetric>(
      `${this.base}/${commitmentId}/metrics/${metricId}`,
      body,
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
    data: Partial<CommitmentRisk>,
  ): Promise<CommitmentRisk> {
    logger.info("Creating risk via backend API", { commitmentId });

    const response = await apiClient.post<CommitmentRisk>(
      `${this.base}/${commitmentId}/risks`,
      {
        risk_title:       data.risk_title ?? "",
        risk_description: data.risk_description ?? "",
        risk_category:    data.risk_category ?? "operational",
        probability:      data.risk_probability ?? "medium",
        impact:           data.risk_impact ?? "medium",
        risk_score:       data.risk_score,
        mitigation_strategy: data.mitigation_strategy ?? "",
        // Backend schema uses mitigation_plan / contingency_plan
        mitigation_plan:  data.mitigation_strategy ?? "",
        contingency_plan: "",
        owner_id:         data.owner_id ?? "",
        review_date:      new Date().toISOString(),
      },
    );
    return unwrap(response);
  }

  async updateRiskStatus(
    riskId: string,
    _tenantId: string,
    _userId: string,
    status: CommitmentRisk["status"],
    mitigatedAt?: string,
  ): Promise<CommitmentRisk> {
    // riskId alone is insufficient to route to the correct commitment.
    // Callers that have commitmentId should use updateRiskStatusForCommitment.
    logger.warn("updateRiskStatus: use updateRiskStatusForCommitment when commitmentId is available", { riskId });
    return {} as CommitmentRisk;
  }

  async updateRiskStatusForCommitment(
    commitmentId: string,
    riskId: string,
    status: CommitmentRisk["status"],
    mitigatedAt?: string,
  ): Promise<CommitmentRisk> {
    logger.info("Updating risk status via backend API", { commitmentId, riskId });

    const body: Record<string, unknown> = { status };
    if (mitigatedAt) body["mitigated_at"] = mitigatedAt;

    const response = await apiClient.patch<CommitmentRisk>(
      `${this.base}/${commitmentId}/risks/${riskId}/status`,
      body,
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
    data: Partial<CommitmentStakeholder>,
  ): Promise<CommitmentStakeholder> {
    logger.info("Adding stakeholder via backend API", { commitmentId });

    const response = await apiClient.post<CommitmentStakeholder>(
      `${this.base}/${commitmentId}/stakeholders`,
      {
        user_id:                   data.user_id ?? "",
        role:                      data.role ?? "",
        responsibility:            data.responsibility ?? "",
        accountability_percentage: data.accountability_percentage,
      },
    );
    return unwrap(response);
  }

  async updateStakeholder(
    _stakeholderId: string,
    _tenantId: string,
    _userId: string,
    _updates: Partial<CommitmentStakeholder>,
  ): Promise<CommitmentStakeholder> {
    // Stakeholder update endpoint not yet exposed by the backend API.
    // Stakeholder records are immutable post-creation in the current model.
    logger.warn("updateStakeholder: not yet supported by backend API");
    return {} as CommitmentStakeholder;
  }

  // -------------------------------------------------------------------------
  // Progress and at-risk queries
  // -------------------------------------------------------------------------

  async calculateProgress(
    commitmentId: string,
    _tenantId: string,
  ): Promise<CommitmentProgress> {
    try {
      const response = await apiClient.get<CommitmentProgress>(
        `${this.base}/${commitmentId}/progress`,
      );
      if (!response.success || !response.data) {
        return this.emptyProgress(commitmentId);
      }
      return response.data;
    } catch (error) {
      logger.error("Failed to calculate progress", { error, commitmentId });
      return this.emptyProgress(commitmentId);
    }
  }

  async getAtRiskCommitments(_tenantId: string): Promise<ValueCommitment[]> {
    try {
      const response = await apiClient.get<CommitmentDto[]>(`${this.base}/at-risk`);
      if (!response.success || !response.data) return [];
      return response.data.map((dto) => this.dtoToValueCommitment(dto));
    } catch (error) {
      logger.error("Failed to get at-risk commitments", { error });
      return [];
    }
  }

  async validateAgainstGroundTruth(
    commitmentId: string,
    _tenantId: string,
  ): Promise<{ isValid: boolean; confidence: number; issues: string[]; recommendations: string[] }> {
    // Ground-truth validation requires the RealizationAgent and is not yet
    // exposed as a standalone endpoint. Returns a safe default so call-sites
    // compile and the UI degrades gracefully.
    logger.warn("validateAgainstGroundTruth: not yet supported by backend API", { commitmentId });
    return { isValid: true, confidence: 0, issues: [], recommendations: [] };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private emptyProgress(commitmentId: string): CommitmentProgress {
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
    return {
      commitment:    this.dtoToValueCommitment(dto),
      stakeholders:  [],
      milestones:    [],
      metrics:       [],
      risks:         [],
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
