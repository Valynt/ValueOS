/**
 * ValueIntegrityService
 *
 * Cross-agent contradiction detection and integrity scoring for business cases.
 *
 * Detects four contradiction types:
 *   SCALAR_CONFLICT    — two agents assert different numeric values for the same metric
 *   FINANCIAL_SANITY   — a single agent's output fails plausibility thresholds
 *   LOGIC_CHAIN_BREAK  — an agent's implied condition is contradicted by another agent
 *   UNIT_MISMATCH      — two agents reference the same metric with incompatible units/scale
 *
 * Scoring formula (composite):
 *   integrity_score = 0.5 * defense_readiness_score
 *                   + 0.5 * (1 - sum(violation_penalties))
 *   clamped to [0, 1]
 *
 * Sprint 53 — Value Integrity Layer
 */

import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import {
  NON_DISMISSABLE_TYPES,
  type Violation,
  type ViolationSeverity,
  type ViolationType,
} from "@shared/domain/Violation.js";
import { logger } from "../lib/logger.js";
import { createRequestSupabaseClient } from "../../lib/supabase.js";
import { getMessageBus } from "../realtime/MessageBus.js";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** A single agent's financial output extracted for sanity checking. */
interface AgentFinancialOutput {
  agent_id: string;
  roi_multiplier: number | null;
  payback_months: number | null;
  value_low_usd: number | null;
  value_high_usd: number | null;
}

/** A single agent's metric claim extracted for scalar/unit comparison. */
interface AgentMetricClaim {
  agent_id: string;
  metric_name: string;
  value: number;
  unit: string;
}

// ---------------------------------------------------------------------------
// Financial sanity thresholds
// ---------------------------------------------------------------------------

const FINANCIAL_SANITY = {
  ROI_MAX_MULTIPLIER: 10,
  PAYBACK_MIN_MONTHS: 1,
  VALUE_RANGE_MAX_RATIO: 5,
} as const;

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------

const PENALTY = {
  critical: 0.2,
  warning: 0.05,
  info: 0.01,
} as const satisfies Record<ViolationSeverity, number>;

const DISMISSED_PENALTY = {
  critical: 0.05,
  warning: 0.01,
  info: 0,
} as const satisfies Record<ViolationSeverity, number>;

const SCORE_WEIGHTS = {
  readiness: 0.5,
  integrity: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Hard-block check result
// ---------------------------------------------------------------------------

export interface HardBlockResult {
  blocked: boolean;
  violations: Violation[];
  soft_warnings: Violation[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ValueIntegrityService {
  /**
   * Detect all contradiction types for a business case.
   *
   * Persists new violations to value_integrity_violations and returns the
   * full list of detected issues (including pre-existing OPEN violations).
   */
  async detectContradictions(
    caseId: string,
    organizationId: string,
    accessToken: string,
    traceId?: string,
  ): Promise<Violation[]> {
    const client = createRequestSupabaseClient({ accessToken });

    // Fetch agent outputs for this case (value_hypotheses as proxy for agent claims)
    const { data: hypotheses, error: hypError } = await client
      .from("value_hypotheses")
      .select("id, agent_id, metric_name, value_low_usd, value_high_usd, roi_multiplier, payback_months, unit, implied_conditions")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId);

    if (hypError) {
      logger.error("ValueIntegrityService: failed to fetch hypotheses", hypError);
      throw new Error(`Failed to fetch agent outputs: ${hypError.message}`);
    }

    const rows = hypotheses ?? [];
    const detectedViolations: Omit<Violation, "id" | "created_at" | "updated_at">[] = [];

    // --- Detection rule 1: SCALAR_CONFLICT ---
    detectedViolations.push(...this.detectScalarConflicts(rows, caseId, organizationId));

    // --- Detection rule 2: FINANCIAL_SANITY ---
    detectedViolations.push(...this.detectFinancialSanity(rows, caseId, organizationId));

    // --- Detection rule 3: LOGIC_CHAIN_BREAK ---
    detectedViolations.push(...this.detectLogicChainBreaks(rows, caseId, organizationId));

    // --- Detection rule 4: UNIT_MISMATCH ---
    detectedViolations.push(...this.detectUnitMismatches(rows, caseId, organizationId));

    // Fetch existing OPEN violations to deduplicate before inserting.
    // A violation is a duplicate if it shares the same (type, sorted agent_ids).
    // This prevents penalty inflation when detectContradictions is called on
    // repeated agent runs for the same case.
    const { data: existingOpen, error: existingError } = await client
      .from("value_integrity_violations")
      .select("type, agent_ids")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .eq("status", "OPEN");

    if (existingError) {
      logger.error("ValueIntegrityService: failed to fetch existing violations for dedup", existingError);
      throw new Error(`Failed to fetch existing violations: ${existingError.message}`);
    }

    const existingKeys = new Set(
      (existingOpen ?? []).map((v: { type: string; agent_ids: string[] }) =>
        `${v.type}:${[...v.agent_ids].sort().join(",")}`,
      ),
    );

    const newViolations = detectedViolations.filter((v) => {
      const key = `${v.type}:${[...v.agent_ids].sort().join(",")}`;
      return !existingKeys.has(key);
    });

    // Persist net-new violations only
    if (newViolations.length > 0) {
      const now = new Date().toISOString();
      const records = newViolations.map((v) => ({
        id: uuidv4(),
        ...v,
        created_at: now,
        updated_at: now,
      }));

      const { error: insertError } = await client
        .from("value_integrity_violations")
        .insert(records);

      if (insertError) {
        logger.error("ValueIntegrityService: failed to persist violations", insertError);
        throw new Error(`Failed to persist violations: ${insertError.message}`);
      }

      // Emit ContradictionEvent via MessageBus
      await this.emitContradictionEvent(records as Violation[], caseId, organizationId, traceId);
    }

    // Return all OPEN violations for this case
    const { data: allViolations, error: fetchError } = await client
      .from("value_integrity_violations")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .eq("status", "OPEN");

    if (fetchError) {
      throw new Error(`Failed to fetch violations: ${fetchError.message}`);
    }

    return (allViolations ?? []) as Violation[];
  }

  /**
   * Recompute and persist integrity_score for a business case.
   *
   * Called after every agent run completes.
   */
  async recomputeScore(
    caseId: string,
    organizationId: string,
    accessToken: string,
  ): Promise<number> {
    const client = createRequestSupabaseClient({ accessToken });

    // Fetch defense_readiness_score from business_cases
    const { data: caseRow, error: caseError } = await client
      .from("business_cases")
      .select("defense_readiness_score, integrity_score")
      .eq("id", caseId)
      .eq("organization_id", organizationId)
      .single();

    if (caseError) {
      throw new Error(`Failed to fetch business case: ${caseError.message}`);
    }

    const defenseReadiness: number = (caseRow as { defense_readiness_score: number | null })?.defense_readiness_score ?? 0;

    // Fetch all violations (OPEN + DISMISSED) for penalty calculation
    const { data: violations, error: vivError } = await client
      .from("value_integrity_violations")
      .select("severity, status")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .in("status", ["OPEN", "DISMISSED"]);

    if (vivError) {
      throw new Error(`Failed to fetch violations: ${vivError.message}`);
    }

    const rows = (violations ?? []) as Array<{ severity: ViolationSeverity; status: string }>;

    // Sum penalties
    let penaltySum = 0;
    for (const row of rows) {
      if (row.status === "OPEN") {
        penaltySum += PENALTY[row.severity] ?? 0;
      } else if (row.status === "DISMISSED") {
        penaltySum += DISMISSED_PENALTY[row.severity] ?? 0;
      }
    }

    const contradictionComponent = Math.max(0, 1 - penaltySum);
    const rawScore =
      SCORE_WEIGHTS.readiness * defenseReadiness +
      SCORE_WEIGHTS.integrity * contradictionComponent;

    const integrityScore = Math.min(1, Math.max(0, rawScore));
    const rounded = Math.round(integrityScore * 1000) / 1000;

    // Persist
    const { error: updateError } = await client
      .from("business_cases")
      .update({ integrity_score: rounded, updated_at: new Date().toISOString() })
      .eq("id", caseId)
      .eq("organization_id", organizationId);

    if (updateError) {
      throw new Error(`Failed to update integrity_score: ${updateError.message}`);
    }

    logger.info(`ValueIntegrityService: integrity_score=${rounded} for case ${caseId}`);
    return rounded;
  }

  /**
   * Check whether a business case has any open critical violations.
   *
   * Used as a gate before status transitions to in_review.
   */
  async checkHardBlocks(
    caseId: string,
    organizationId: string,
    accessToken: string,
  ): Promise<HardBlockResult> {
    const client = createRequestSupabaseClient({ accessToken });

    const { data: violations, error } = await client
      .from("value_integrity_violations")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .eq("status", "OPEN");

    if (error) {
      throw new Error(`Failed to fetch violations: ${error.message}`);
    }

    const all = (violations ?? []) as Violation[];
    const criticals = all.filter((v) => v.severity === "critical");
    const warnings = all.filter((v) => v.severity === "warning");

    return {
      blocked: criticals.length > 0,
      violations: criticals,
      soft_warnings: warnings,
    };
  }

  /**
   * Resolve a violation by re-evaluation or human dismissal.
   *
   * Returns the updated violation.
   */
  async resolveViolation(
    violationId: string,
    organizationId: string,
    accessToken: string,
    resolution: {
      resolution_type: "RE_EVALUATE" | "DISMISS";
      resolved_by: string;
      reason_code?: string;
      comment?: string;
    },
  ): Promise<Violation> {
    const client = createRequestSupabaseClient({ accessToken });

    // Fetch the violation
    const { data: existing, error: fetchError } = await client
      .from("value_integrity_violations")
      .select("*")
      .eq("id", violationId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !existing) {
      throw new Error(`Violation not found: ${violationId}`);
    }

    const violation = existing as Violation;

    // Guard: non-dismissable types cannot be dismissed
    if (
      resolution.resolution_type === "DISMISS" &&
      violation.severity === "critical" &&
      NON_DISMISSABLE_TYPES.has(violation.type)
    ) {
      throw new NonDismissableViolationError(violation.type);
    }

    // Guard: DISMISS requires reason_code + comment
    if (resolution.resolution_type === "DISMISS") {
      if (!resolution.reason_code || !resolution.comment) {
        throw new Error("DISMISS resolution requires reason_code and comment");
      }
    }

    const now = new Date().toISOString();
    const newStatus = resolution.resolution_type === "DISMISS" ? "DISMISSED" : "RESOLVED_AUTO";
    const metadata =
      resolution.resolution_type === "DISMISS"
        ? { reason_code: resolution.reason_code, comment: resolution.comment }
        : { re_evaluated_at: now };

    const { data: updated, error: updateError } = await client
      .from("value_integrity_violations")
      .update({
        status: newStatus,
        resolved_by: resolution.resolved_by,
        resolution_metadata: metadata,
        updated_at: now,
      })
      .eq("id", violationId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update violation: ${updateError?.message}`);
    }

    return updated as Violation;
  }

  // ---------------------------------------------------------------------------
  // Detection rules (pure — no DB access, operate on in-memory rows)
  // ---------------------------------------------------------------------------

  /**
   * SCALAR_CONFLICT: two agents assert different numeric values for the same metric.
   *
   * Threshold: values differ by more than 20% relative to the larger value.
   */
  detectScalarConflicts(
    rows: AgentMetricClaim[],
    caseId: string,
    organizationId: string,
  ): Omit<Violation, "id" | "created_at" | "updated_at">[] {
    const violations: Omit<Violation, "id" | "created_at" | "updated_at">[] = [];

    // Group by metric_name
    const byMetric = new Map<string, AgentMetricClaim[]>();
    for (const row of rows) {
      if (!row.metric_name || row.value == null) continue;
      const key = row.metric_name.toLowerCase().trim();
      const existing = byMetric.get(key) ?? [];
      existing.push(row);
      byMetric.set(key, existing);
    }

    for (const [metric, claims] of byMetric) {
      if (claims.length < 2) continue;

      // Compare all pairs
      for (let i = 0; i < claims.length; i++) {
        for (let j = i + 1; j < claims.length; j++) {
          const a = claims[i]!;
          const b = claims[j]!;
          if (a.agent_id === b.agent_id) continue;

          const larger = Math.max(Math.abs(a.value), Math.abs(b.value));
          if (larger === 0) continue;

          const relativeDiff = Math.abs(a.value - b.value) / larger;
          if (relativeDiff > 0.2) {
            violations.push({
              case_id: caseId,
              organization_id: organizationId,
              type: "SCALAR_CONFLICT",
              severity: "critical",
              description: `Scalar conflict on "${metric}": agent ${a.agent_id} reports ${a.value}, agent ${b.agent_id} reports ${b.value} (${Math.round(relativeDiff * 100)}% difference).`,
              agent_ids: [a.agent_id, b.agent_id],
              status: "OPEN",
              resolved_by: null,
              resolution_metadata: null,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * FINANCIAL_SANITY: a single agent's output fails plausibility thresholds.
   */
  detectFinancialSanity(
    rows: AgentFinancialOutput[],
    caseId: string,
    organizationId: string,
  ): Omit<Violation, "id" | "created_at" | "updated_at">[] {
    const violations: Omit<Violation, "id" | "created_at" | "updated_at">[] = [];

    for (const row of rows) {
      // ROI > 10x → critical
      if (row.roi_multiplier != null && row.roi_multiplier > FINANCIAL_SANITY.ROI_MAX_MULTIPLIER) {
        violations.push({
          case_id: caseId,
          organization_id: organizationId,
          type: "FINANCIAL_SANITY",
          severity: "critical",
          description: `ROI of ${row.roi_multiplier}x exceeds the plausibility threshold of ${FINANCIAL_SANITY.ROI_MAX_MULTIPLIER}x (agent: ${row.agent_id}).`,
          agent_ids: [row.agent_id],
          status: "OPEN",
          resolved_by: null,
          resolution_metadata: null,
        });
      }

      // Payback < 1 month → critical
      if (row.payback_months != null && row.payback_months < FINANCIAL_SANITY.PAYBACK_MIN_MONTHS) {
        violations.push({
          case_id: caseId,
          organization_id: organizationId,
          type: "FINANCIAL_SANITY",
          severity: "critical",
          description: `Payback period of ${row.payback_months} month(s) is below the minimum plausible threshold of ${FINANCIAL_SANITY.PAYBACK_MIN_MONTHS} month (agent: ${row.agent_id}).`,
          agent_ids: [row.agent_id],
          status: "OPEN",
          resolved_by: null,
          resolution_metadata: null,
        });
      }

      // Value range spread > 5x → warning
      if (
        row.value_low_usd != null &&
        row.value_high_usd != null &&
        row.value_low_usd > 0 &&
        row.value_high_usd / row.value_low_usd > FINANCIAL_SANITY.VALUE_RANGE_MAX_RATIO
      ) {
        const ratio = row.value_high_usd / row.value_low_usd;
        violations.push({
          case_id: caseId,
          organization_id: organizationId,
          type: "FINANCIAL_SANITY",
          severity: "warning",
          description: `Value range spread of ${ratio.toFixed(1)}x (low: $${row.value_low_usd}, high: $${row.value_high_usd}) exceeds the ${FINANCIAL_SANITY.VALUE_RANGE_MAX_RATIO}x threshold (agent: ${row.agent_id}).`,
          agent_ids: [row.agent_id],
          status: "OPEN",
          resolved_by: null,
          resolution_metadata: null,
        });
      }
    }

    return violations;
  }

  /**
   * LOGIC_CHAIN_BREAK: an agent's implied condition is contradicted by another agent.
   *
   * Detects when one agent asserts a positive condition (e.g., "cost savings identified")
   * and another agent explicitly negates it.
   *
   * Uses sets of agent IDs per condition key to avoid last-write-wins overwriting
   * when multiple rows from the same agent assert the same condition.
   */
  detectLogicChainBreaks(
    rows: Array<{ agent_id: string; implied_conditions?: string[] | null }>,
    caseId: string,
    organizationId: string,
  ): Omit<Violation, "id" | "created_at" | "updated_at">[] {
    const violations: Omit<Violation, "id" | "created_at" | "updated_at">[] = [];

    // Collect all positive and negative condition assertions.
    // Map from condition_key -> Set<agent_id> to handle multiple rows per agent
    // and avoid last-write-wins overwriting when the same condition appears twice.
    const positives = new Map<string, Set<string>>(); // condition_key -> agent_ids
    const negatives = new Map<string, Set<string>>(); // condition_key -> agent_ids

    for (const row of rows) {
      if (!row.implied_conditions) continue;
      for (const condition of row.implied_conditions) {
        const normalized = condition.toLowerCase().trim();
        if (normalized.startsWith("no ") || normalized.startsWith("not ")) {
          // Negative assertion: strip the negation prefix to get the base condition
          const base = normalized.replace(/^(no |not )/, "").trim();
          const existing = negatives.get(base) ?? new Set<string>();
          existing.add(row.agent_id);
          negatives.set(base, existing);
        } else {
          const existing = positives.get(normalized) ?? new Set<string>();
          existing.add(row.agent_id);
          positives.set(normalized, existing);
        }
      }
    }

    // Find conflicts: a positive condition that is also negated by a *different* agent.
    // Emit one violation per (condition, positiveAgent, negativeAgent) pair to
    // preserve full attribution when multiple agents are involved.
    for (const [condition, positiveAgentIds] of positives) {
      const negativeAgentIds = negatives.get(condition);
      if (!negativeAgentIds) continue;

      for (const positiveAgentId of positiveAgentIds) {
        for (const negativeAgentId of negativeAgentIds) {
          if (positiveAgentId === negativeAgentId) continue;
          violations.push({
            case_id: caseId,
            organization_id: organizationId,
            type: "LOGIC_CHAIN_BREAK",
            severity: "critical",
            description: `Logic chain break on condition "${condition}": agent ${positiveAgentId} asserts it holds, agent ${negativeAgentId} asserts it does not.`,
            agent_ids: [positiveAgentId, negativeAgentId],
            status: "OPEN",
            resolved_by: null,
            resolution_metadata: null,
          });
        }
      }
    }

    return violations;
  }

  /**
   * UNIT_MISMATCH: two agents reference the same metric with incompatible units or scale.
   *
   * Detects currency mismatches (e.g., USD vs GBP) and magnitude mismatches
   * (e.g., values that differ by 1000x suggesting thousands vs millions confusion).
   */
  detectUnitMismatches(
    rows: AgentMetricClaim[],
    caseId: string,
    organizationId: string,
  ): Omit<Violation, "id" | "created_at" | "updated_at">[] {
    const violations: Omit<Violation, "id" | "created_at" | "updated_at">[] = [];

    // Group by metric_name
    const byMetric = new Map<string, AgentMetricClaim[]>();
    for (const row of rows) {
      if (!row.metric_name || !row.unit) continue;
      const key = row.metric_name.toLowerCase().trim();
      const existing = byMetric.get(key) ?? [];
      existing.push(row);
      byMetric.set(key, existing);
    }

    for (const [metric, claims] of byMetric) {
      if (claims.length < 2) continue;

      for (let i = 0; i < claims.length; i++) {
        for (let j = i + 1; j < claims.length; j++) {
          const a = claims[i]!;
          const b = claims[j]!;
          if (a.agent_id === b.agent_id) continue;

          const unitA = a.unit.toLowerCase().trim();
          const unitB = b.unit.toLowerCase().trim();

          // Currency mismatch
          const currencies = new Set(["usd", "gbp", "eur", "cad", "aud"]);
          const aIsCurrency = currencies.has(unitA);
          const bIsCurrency = currencies.has(unitB);
          if (aIsCurrency && bIsCurrency && unitA !== unitB) {
            violations.push({
              case_id: caseId,
              organization_id: organizationId,
              type: "UNIT_MISMATCH",
              severity: "critical",
              description: `Unit mismatch on "${metric}": agent ${a.agent_id} uses ${unitA.toUpperCase()}, agent ${b.agent_id} uses ${unitB.toUpperCase()}.`,
              agent_ids: [a.agent_id, b.agent_id],
              status: "OPEN",
              resolved_by: null,
              resolution_metadata: null,
            });
            continue;
          }

          // Magnitude mismatch (same unit, values differ by 1000x or more)
          if (unitA === unitB && a.value > 0 && b.value > 0) {
            const ratio = Math.max(a.value, b.value) / Math.min(a.value, b.value);
            if (ratio >= 1000) {
              violations.push({
                case_id: caseId,
                organization_id: organizationId,
                type: "UNIT_MISMATCH",
                severity: "warning",
                description: `Possible scale mismatch on "${metric}": agent ${a.agent_id} reports ${a.value} ${unitA}, agent ${b.agent_id} reports ${b.value} ${unitB} (${Math.round(ratio)}x difference — possible thousands vs millions confusion).`,
                agent_ids: [a.agent_id, b.agent_id],
                status: "OPEN",
                resolved_by: null,
                resolution_metadata: null,
              });
            }
          }
        }
      }
    }

    return violations;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async emitContradictionEvent(
    violations: Violation[],
    caseId: string,
    organizationId: string,
    traceId?: string,
  ): Promise<void> {
    try {
      const bus = getMessageBus();
      await bus.publishMessage("integrity", {
        event_type: "notification",
        sender_id: "ValueIntegrityService",
        recipient_ids: ["*"],
        message_type: "integrity.contradiction.detected",
        content: `${violations.length} violation(s) detected for case ${caseId}`,
        payload: {
          schemaVersion: "1.0",
          idempotencyKey: uuidv4(),
          emittedAt: new Date().toISOString(),
          organizationId,
          caseId,
          violations,
        },
        trace_id: traceId ?? uuidv4(),
        organization_id: organizationId,
      });
    } catch (err) {
      // Non-fatal: log but don't fail the detection run
      logger.error(
        "ValueIntegrityService: failed to emit ContradictionEvent",
        err instanceof Error ? err : undefined,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export class NonDismissableViolationError extends Error {
  readonly violationType: ViolationType;

  constructor(type: ViolationType) {
    super(
      `Violation of type ${type} with severity 'critical' cannot be dismissed. ` +
        "It must be resolved via RE_EVALUATE (data correction).",
    );
    this.name = "NonDismissableViolationError";
    this.violationType = type;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const valueIntegrityService = new ValueIntegrityService();
