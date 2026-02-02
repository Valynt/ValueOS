/**
 * Value Commitment Tracking Service
 *
 * Service for managing value commitments, stakeholders, milestones, metrics, and risks.
 * Provides comprehensive tracking and management of value commitments throughout their lifecycle.
 */

import { z } from "zod";
import {
  ValueCommitment,
  CommitmentStakeholder,
  CommitmentMilestone,
  CommitmentMetric,
  CommitmentAudit,
  CommitmentRisk,
  CommitmentProgress,
  CommitmentDashboard,
  ValueCommitmentInsert,
  CommitmentStakeholderInsert,
  CommitmentMilestoneInsert,
  CommitmentMetricInsert,
  CommitmentAuditInsert,
  CommitmentRiskInsert,
} from "../types/value-commitment-tracking.js";
import {
  ValueCommitmentSchema,
  CommitmentStakeholderSchema,
  CommitmentMilestoneSchema,
  CommitmentMetricSchema,
  CommitmentAuditSchema,
  CommitmentRiskSchema,
} from "../types/value-commitment-schemas.js";
import { logger } from "../lib/logger";
import { supabase } from "../lib/supabase";
import { GroundTruthIntegrationService } from "./GroundTruthIntegrationService.js";

export class ValueCommitmentTrackingService {
  private groundTruthService: GroundTruthIntegrationService;

  constructor(groundTruthService: GroundTruthIntegrationService) {
    this.groundTruthService = groundTruthService;
  }

  // =========================
  // Value Commitment CRUD Operations
  // =========================

  /**
   * Create a new value commitment
   */
  async createCommitment(
    tenantId: string,
    userId: string,
    sessionId: string,
    data: Omit<ValueCommitmentInsert, "tenant_id" | "user_id" | "session_id">
  ): Promise<ValueCommitment> {
    try {
      const commitmentData = {
        ...data,
        tenant_id: tenantId,
        user_id: userId,
        session_id: sessionId,
        committed_at: new Date().toISOString(),
      };

      // Validate the data
      const validatedData = ValueCommitmentSchema.parse(commitmentData);

      // TODO: Insert into database
      // const commitment = await this.db.insert('value_commitments').values(validatedData).returning();

      // Create audit entry
      await this.createAuditEntry(
        tenantId,
        validatedData.id,
        userId,
        "created",
        {},
        validatedData,
        "Initial commitment creation"
      );

      // Add creator as owner stakeholder
      await this.addStakeholder(validatedData.id, tenantId, userId, {
        role: "owner",
        responsibility: "Commitment owner and primary responsible party",
        accountability_percentage: 100,
      });

      logger.info("Value commitment created", {
        commitmentId: validatedData.id,
        tenantId,
        userId,
        title: validatedData.title,
      });

      return validatedData as ValueCommitment;
    } catch (error) {
      logger.error("Failed to create value commitment", { error, tenantId, userId });
      throw error;
    }
  }

  /**
   * Get commitment by ID with full details
   */
  async getCommitment(commitmentId: string, tenantId: string): Promise<CommitmentDashboard | null> {
    try {
      if (!supabase) {
        throw new Error("Supabase client not initialized");
      }

      // Fetch commitment and related entities in parallel (optimized to 2 round trips)
      const [commitmentResponse, auditsResponse] = await Promise.all([
        supabase
          .from("value_commitments")
          .select(`
            *,
            commitment_stakeholders(*),
            commitment_milestones(*),
            commitment_metrics(*),
            commitment_risks(*)
          `)
          .eq("id", commitmentId)
          .eq("tenant_id", tenantId)
          .single(),
        supabase
          .from("commitment_audits")
          .select("*")
          .eq("commitment_id", commitmentId)
          .eq("tenant_id", tenantId)
          .order("timestamp", { ascending: false })
          .limit(10),
      ]);

      if (commitmentResponse.error) {
        // If it's a "no rows found" error, return null
        if (commitmentResponse.error.code === "PGRST116") {
          return null;
        }
        throw commitmentResponse.error;
      }

      if (!commitmentResponse.data) {
        return null;
      }

      // Map the nested response to Dashboard structure
      const data = commitmentResponse.data as any;
      const commitment = { ...data };
      // Remove nested arrays from commitment object to match ValueCommitment type strictly if needed
      delete commitment.commitment_stakeholders;
      delete commitment.commitment_milestones;
      delete commitment.commitment_metrics;
      delete commitment.commitment_risks;

      const stakeholders = (data.commitment_stakeholders || []) as CommitmentStakeholder[];
      const milestones = (data.commitment_milestones || []) as CommitmentMilestone[];
      const metrics = (data.commitment_metrics || []) as CommitmentMetric[];
      const risks = (data.commitment_risks || []) as CommitmentRisk[];
      const recent_audits = (auditsResponse.data || []) as CommitmentAudit[];

      // Calculate progress
      const now = new Date();
      const targetDate = commitment.target_completion_date
        ? new Date(commitment.target_completion_date)
        : null;
      const daysRemaining = targetDate
        ? Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const milestoneCompletion =
        milestones.length > 0
          ? (milestones.filter((m) => m.status === "completed").length / milestones.length) * 100
          : 0;

      const metricAchievement =
        metrics.length > 0
          ? metrics.reduce((acc, m) => {
              if (m.target_value && m.target_value > 0) {
                // Cap at 100% for individual metrics contribution
                return acc + Math.min((m.current_value / m.target_value) * 100, 100);
              }
              return acc;
            }, 0) / metrics.length
          : 0;

      // Simple risk level logic
      const highRisks = risks.filter((r) => r.risk_score >= 8).length;
      const mediumRisks = risks.filter((r) => r.risk_score >= 4 && r.risk_score < 8).length;
      let riskLevel = "low";
      if (highRisks > 0) riskLevel = "high";
      else if (mediumRisks > 0) riskLevel = "medium";

      const progress: CommitmentProgress = {
        commitment_id: commitmentId,
        overall_progress: commitment.progress_percentage || 0,
        milestone_completion: Math.round(milestoneCompletion),
        metric_achievement: Math.round(metricAchievement),
        risk_level: riskLevel,
        days_remaining: daysRemaining,
        is_on_track:
          commitment.status !== "at_risk" &&
          commitment.status !== "cancelled" &&
          commitment.progress_percentage >= milestoneCompletion - 10, // heuristic
      };

      return {
        commitment,
        stakeholders,
        milestones,
        metrics,
        risks,
        progress,
        recent_audits,
      };
    } catch (error) {
      logger.error("Failed to get commitment", { error, commitmentId, tenantId });
      throw error;
    }
  }

  /**
   * Update commitment status and progress
   */
  async updateCommitmentStatus(
    commitmentId: string,
    tenantId: string,
    userId: string,
    status: ValueCommitment["status"],
    progressPercentage?: number,
    reason?: string
  ): Promise<ValueCommitment> {
    try {
      // TODO: Update in database
      // const existing = await this.getCommitmentBasic(commitmentId, tenantId);
      // const updated = await this.db.update('value_commitments')
      //   .set({ status, progress_percentage: progressPercentage, updated_at: new Date() })
      //   .where(eq('id', commitmentId))
      //   .returning();

      // Create audit entry
      // await this.createAuditEntry(tenantId, commitmentId, userId, 'status_changed',
      //   { status: existing.status, progress_percentage: existing.progress_percentage },
      //   { status, progress_percentage: progressPercentage },
      //   reason || 'Status update'
      // );

      logger.info("Commitment status updated", {
        commitmentId,
        tenantId,
        status,
        progressPercentage,
      });

      // Return mock updated commitment
      return {} as ValueCommitment;
    } catch (error) {
      logger.error("Failed to update commitment status", { error, commitmentId, tenantId });
      throw error;
    }
  }

  // =========================
  // Stakeholder Management
  // =========================

  /**
   * Add a stakeholder to a commitment
   */
  async addStakeholder(
    commitmentId: string,
    tenantId: string,
    userId: string,
    stakeholderData: Omit<CommitmentStakeholderInsert, "commitment_id" | "tenant_id" | "user_id">
  ): Promise<CommitmentStakeholder> {
    try {
      const data = {
        ...stakeholderData,
        commitment_id: commitmentId,
        tenant_id: tenantId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      const validatedData = CommitmentStakeholderSchema.parse(data);

      // TODO: Insert into database
      // const stakeholder = await this.db.insert('commitment_stakeholders').values(validatedData).returning();

      // Create audit entry
      await this.createAuditEntry(
        tenantId,
        commitmentId,
        userId,
        "stakeholder_added",
        {},
        validatedData,
        "Stakeholder added to commitment"
      );

      logger.info("Stakeholder added to commitment", {
        commitmentId,
        tenantId,
        stakeholderId: userId,
        role: stakeholderData.role,
      });

      return validatedData as CommitmentStakeholder;
    } catch (error) {
      logger.error("Failed to add stakeholder", { error, commitmentId, tenantId, userId });
      throw error;
    }
  }

  /**
   * Update stakeholder accountability and status
   */
  async updateStakeholder(
    stakeholderId: string,
    tenantId: string,
    userId: string,
    updates: Partial<
      Pick<
        CommitmentStakeholder,
        "accountability_percentage" | "is_active" | "notification_preferences"
      >
    >
  ): Promise<CommitmentStakeholder> {
    try {
      // TODO: Update in database
      // const existing = await this.db.query.commitment_stakeholders.findFirst({
      //   where: eq('id', stakeholderId) && eq('tenant_id', tenantId)
      // });
      // const updated = await this.db.update('commitment_stakeholders')
      //   .set({ ...updates, updated_at: new Date() })
      //   .where(eq('id', stakeholderId))
      //   .returning();

      // Create audit entry
      // await this.createAuditEntry(tenantId, updated.commitment_id, userId, 'updated', existing, updated, 'Stakeholder updated');

      logger.info("Stakeholder updated", { stakeholderId, tenantId, updates });

      return {} as CommitmentStakeholder;
    } catch (error) {
      logger.error("Failed to update stakeholder", { error, stakeholderId, tenantId });
      throw error;
    }
  }

  // =========================
  // Milestone Management
  // =========================

  /**
   * Create a milestone for a commitment
   */
  async createMilestone(
    commitmentId: string,
    tenantId: string,
    userId: string,
    milestoneData: Omit<CommitmentMilestoneInsert, "commitment_id" | "tenant_id">
  ): Promise<CommitmentMilestone> {
    try {
      const data = {
        ...milestoneData,
        commitment_id: commitmentId,
        tenant_id: tenantId,
      };

      const validatedData = CommitmentMilestoneSchema.parse(data);

      // TODO: Insert into database
      // const milestone = await this.db.insert('commitment_milestones').values(validatedData).returning();

      // Create audit entry
      await this.createAuditEntry(
        tenantId,
        commitmentId,
        userId,
        "updated",
        {},
        validatedData,
        "Milestone added"
      );

      logger.info("Milestone created", {
        commitmentId,
        tenantId,
        milestoneId: validatedData.id,
        title: validatedData.title,
      });

      return validatedData as CommitmentMilestone;
    } catch (error) {
      logger.error("Failed to create milestone", { error, commitmentId, tenantId });
      throw error;
    }
  }

  /**
   * Update milestone progress and status
   */
  async updateMilestoneProgress(
    milestoneId: string,
    tenantId: string,
    userId: string,
    progressPercentage: number,
    status?: CommitmentMilestone["status"],
    actualDate?: string
  ): Promise<CommitmentMilestone> {
    try {
      // TODO: Update in database and trigger progress recalculation
      // const updated = await this.db.update('commitment_milestones')
      //   .set({
      //     progress_percentage: progressPercentage,
      //     status: status || 'in_progress',
      //     actual_date: actualDate,
      //     updated_at: new Date()
      //   })
      //   .where(eq('id', milestoneId))
      //   .returning();

      // Create audit entry
      await this.createAuditEntry(
        tenantId,
        "",
        userId,
        "milestone_completed",
        {},
        { milestoneId, progressPercentage, status },
        "Milestone progress updated"
      );

      // TODO: Trigger commitment progress recalculation
      // await this.updateCommitmentProgress(updated.commitment_id);

      logger.info("Milestone progress updated", {
        milestoneId,
        tenantId,
        progressPercentage,
        status,
      });

      return {} as CommitmentMilestone;
    } catch (error) {
      logger.error("Failed to update milestone progress", { error, milestoneId, tenantId });
      throw error;
    }
  }

  // =========================
  // Metric Management
  // =========================

  /**
   * Create a success metric for a commitment
   */
  async createMetric(
    commitmentId: string,
    tenantId: string,
    userId: string,
    metricData: Omit<CommitmentMetricInsert, "commitment_id" | "tenant_id">
  ): Promise<CommitmentMetric> {
    try {
      const data = {
        ...metricData,
        commitment_id: commitmentId,
        tenant_id: tenantId,
      };

      const validatedData = CommitmentMetricSchema.parse(data);

      // TODO: Insert into database
      // const metric = await this.db.insert('commitment_metrics').values(validatedData).returning();

      // Create audit entry
      await this.createAuditEntry(
        tenantId,
        commitmentId,
        userId,
        "updated",
        {},
        validatedData,
        "Success metric added"
      );

      logger.info("Metric created", {
        commitmentId,
        tenantId,
        metricId: validatedData.id,
        metricName: validatedData.metric_name,
      });

      return validatedData as CommitmentMetric;
    } catch (error) {
      logger.error("Failed to create metric", { error, commitmentId, tenantId });
      throw error;
    }
  }

  /**
   * Update metric current value and measurement
   */
  async updateMetricValue(
    metricId: string,
    tenantId: string,
    userId: string,
    currentValue: number,
    lastMeasuredAt?: string
  ): Promise<CommitmentMetric> {
    try {
      if (!supabase) {
        throw new Error("Supabase client not initialized");
      }

      const { data: updated, error } = await supabase
        .from("commitment_metrics")
        .update({
          current_value: currentValue,
          last_measured_at: lastMeasuredAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", metricId)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw error;

      // Create audit entry
      await this.createAuditEntry(
        tenantId,
        updated.commitment_id,
        userId,
        "metric_updated",
        { metricId },
        { metricId, currentValue },
        "Metric value updated"
      );

      // TODO: Trigger commitment progress recalculation
      // await this.updateCommitmentProgress(updated.commitment_id);

      logger.info("Metric value updated", { metricId, tenantId, currentValue });

      return updated as CommitmentMetric;
    } catch (error) {
      logger.error("Failed to update metric value", { error, metricId, tenantId });
      throw error;
    }
  }

  // =========================
  // Risk Management
  // =========================

  /**
   * Create a risk for a commitment
   */
  async createRisk(
    commitmentId: string,
    tenantId: string,
    userId: string,
    riskData: Omit<CommitmentRiskInsert, "commitment_id" | "tenant_id">
  ): Promise<CommitmentRisk> {
    try {
      const data = {
        ...riskData,
        commitment_id: commitmentId,
        tenant_id: tenantId,
        identified_at: new Date().toISOString(),
      };

      const validatedData = CommitmentRiskSchema.parse(data);

      // TODO: Insert into database
      // const risk = await this.db.insert('commitment_risks').values(validatedData).returning();

      // Create audit entry
      await this.createAuditEntry(
        tenantId,
        commitmentId,
        userId,
        "risk_assessed",
        {},
        validatedData,
        "Risk identified"
      );

      logger.info("Risk created", {
        commitmentId,
        tenantId,
        riskId: validatedData.id,
        riskTitle: validatedData.risk_title,
        riskScore: validatedData.risk_score,
      });

      return validatedData as CommitmentRisk;
    } catch (error) {
      logger.error("Failed to create risk", { error, commitmentId, tenantId });
      throw error;
    }
  }

  /**
   * Update risk status and mitigation
   */
  async updateRiskStatus(
    riskId: string,
    tenantId: string,
    userId: string,
    status: CommitmentRisk["status"],
    mitigatedAt?: string
  ): Promise<CommitmentRisk> {
    try {
      // TODO: Update in database
      // const updated = await this.db.update('commitment_risks')
      //   .set({
      //     status,
      //     mitigated_at: mitigatedAt,
      //     updated_at: new Date()
      //   })
      //   .where(eq('id', riskId))
      //   .returning();

      // Create audit entry
      await this.createAuditEntry(
        tenantId,
        "",
        userId,
        "risk_assessed",
        {},
        { riskId, status, mitigatedAt },
        "Risk status updated"
      );

      logger.info("Risk status updated", { riskId, tenantId, status });

      return {} as CommitmentRisk;
    } catch (error) {
      logger.error("Failed to update risk status", { error, riskId, tenantId });
      throw error;
    }
  }

  // =========================
  // Progress & Analytics
  // =========================

  /**
   * Calculate commitment progress metrics
   */
  async calculateProgress(commitmentId: string, tenantId: string): Promise<CommitmentProgress> {
    try {
      // TODO: Calculate from database
      // const milestones = await this.db.query.commitment_milestones.findMany({
      //   where: eq('commitment_id', commitmentId)
      // });
      // const metrics = await this.db.query.commitment_metrics.findMany({
      //   where: eq('commitment_id', commitmentId) && eq('is_active', true)
      // });
      // const risks = await this.db.query.commitment_risks.findMany({
      //   where: eq('commitment_id', commitmentId)
      // });

      // Calculate progress metrics
      const progress: CommitmentProgress = {
        commitment_id: commitmentId,
        overall_progress: 65, // Mock calculation
        milestone_completion: 70,
        metric_achievement: 60,
        risk_level: "medium",
        days_remaining: 45,
        is_on_track: true,
      };

      return progress;
    } catch (error) {
      logger.error("Failed to calculate progress", { error, commitmentId, tenantId });
      throw error;
    }
  }

  /**
   * Get commitments at risk of missing targets
   */
  async getAtRiskCommitments(tenantId: string): Promise<ValueCommitment[]> {
    try {
      // TODO: Query database for commitments that are at risk
      // const atRiskCommitments = await this.db.query.value_commitments.findMany({
      //   where: (commitments, { eq, and, lt, or }) =>
      //     and(
      //       eq(commitments.tenant_id, tenantId),
      //       or(
      //         eq(commitments.status, 'at_risk'),
      //         lt(commitments.progress_percentage, 30) // Less than 30% progress with <30% time remaining
      //       )
      //     )
      // });

      logger.info("Retrieved at-risk commitments", { tenantId, count: 0 });

      return [];
    } catch (error) {
      logger.error("Failed to get at-risk commitments", { error, tenantId });
      throw error;
    }
  }

  // =========================
  // Ground Truth Integration
  // =========================

  /**
   * Validate commitment against ground truth data
   */
  async validateAgainstGroundTruth(
    commitmentId: string,
    tenantId: string
  ): Promise<{
    isValid: boolean;
    confidence: number;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      // TODO: Get commitment and validate against ESO benchmarks
      // const commitment = await this.getCommitmentBasic(commitmentId, tenantId);

      // Use ground truth service to validate
      // const validation = await this.groundTruthService.validateCommitment(commitment);

      const validation = {
        isValid: true,
        confidence: 85,
        issues: [],
        recommendations: [
          "Consider adding more specific KPIs aligned with industry benchmarks",
          "Increase stakeholder engagement for higher accountability",
        ],
      };

      logger.info("Ground truth validation completed", {
        commitmentId,
        tenantId,
        isValid: validation.isValid,
      });

      return validation;
    } catch (error) {
      logger.error("Failed to validate against ground truth", { error, commitmentId, tenantId });
      throw error;
    }
  }

  // =========================
  // Private Helper Methods
  // =========================

  private async createAuditEntry(
    tenantId: string,
    commitmentId: string,
    userId: string,
    action: CommitmentAudit["action"],
    previousValues: Record<string, any>,
    newValues: Record<string, any>,
    reason: string
  ): Promise<void> {
    try {
      const auditData: CommitmentAuditInsert = {
        commitment_id: commitmentId,
        tenant_id: tenantId,
        user_id: userId,
        action,
        previous_values: previousValues,
        new_values: newValues,
        change_reason: reason,
      };

      const validatedAudit = CommitmentAuditSchema.parse(auditData);

      // TODO: Insert audit entry
      // await this.db.insert('commitment_audits').values(validatedAudit);

      logger.debug("Audit entry created", { commitmentId, tenantId, action });
    } catch (error) {
      logger.error("Failed to create audit entry", { error, commitmentId, tenantId });
      // Don't throw - audit failures shouldn't break business logic
    }
  }

  private buildMockDashboard(commitmentId: string): CommitmentDashboard {
    // Mock data for demonstration
    return {
      commitment: {
        id: commitmentId,
        tenant_id: "tenant-123",
        session_id: "session-123",
        user_id: "user-123",
        organization_id: null,
        title: "Sample Value Commitment",
        description: "A sample commitment for demonstration",
        commitment_type: "financial",
        priority: "high",
        financial_impact: {
          revenue_uplift: 500000,
          cost_reduction: 150000,
        },
        currency: "USD",
        timeframe_months: 12,
        status: "in_progress",
        progress_percentage: 65,
        confidence_level: 80,
        committed_at: new Date().toISOString(),
        target_completion_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        actual_completion_date: null,
        ground_truth_references: {
          benchmark_ids: ["saas_nrr", "fin_dso"],
          persona: "ceo",
          industry: "saas",
          confidence_sources: ["ScaleMetrics", "APQC"],
        },
        tags: ["growth", "efficiency"],
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      stakeholders: [],
      milestones: [],
      metrics: [],
      risks: [],
      progress: {
        commitment_id: commitmentId,
        overall_progress: 65,
        milestone_completion: 70,
        metric_achievement: 60,
        risk_level: "medium",
        days_remaining: 45,
        is_on_track: true,
      },
      recent_audits: [],
    };
  }
}
