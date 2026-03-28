/**
 * ExitConditionEvaluator — Domain-aware exit condition evaluation
 *
 * Evaluates phase exit conditions by querying domain repositories.
 * This is the integration point between the JourneyOrchestrator and
 * the persistence layer for conditions that require data verification.
 *
 * Sprint 55: Exit condition evaluator implementation.
 */

import type {
  PhaseExitCondition,
} from "@valueos/shared";

import { logger } from "../../lib/logger.js";

// ---------------------------------------------------------------------------
// Repository Interfaces (subset for exit condition queries)
// ---------------------------------------------------------------------------

export interface ExitConditionRepositoryContext {
  /** Count domain objects of a given type for the opportunity/case. */
  countItems(params: {
    organization_id: string;
    opportunity_id?: string;
    case_id?: string;
    item_type: string;
  }): Promise<number>;

  /** Check if all required fields are populated for the opportunity/case. */
  checkFieldsPopulated(params: {
    organization_id: string;
    opportunity_id?: string;
    case_id?: string;
    required_fields: string[];
  }): Promise<{ all_populated: boolean; missing_fields: string[] }>;
}

// ---------------------------------------------------------------------------
// Evaluation Result
// ---------------------------------------------------------------------------

export interface ExitConditionEvaluation {
  condition: PhaseExitCondition;
  passed: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export class ExitConditionEvaluator {
  constructor(private readonly repositories: ExitConditionRepositoryContext) {}

  /**
   * Evaluate a single exit condition by querying domain data.
   */
  async evaluate(
    condition: PhaseExitCondition,
    context: {
      organization_id: string;
      opportunity_id?: string;
      case_id?: string;
    }
  ): Promise<ExitConditionEvaluation> {
    switch (condition.type) {
      case "min_items":
        return this.evaluateMinItems(condition, context);

      case "all_fields_populated":
        return this.evaluateAllFieldsPopulated(condition, context);

      case "min_confidence":
        // Confidence is evaluated from runtime state, not repositories
        return {
          condition,
          passed: true,
          reason: "Confidence evaluated at runtime by JourneyOrchestrator",
        };

      case "no_unresolved_objections":
        // Objections are evaluated from runtime interrupts, not repositories
        return {
          condition,
          passed: true,
          reason: "Objections evaluated at runtime by JourneyOrchestrator",
        };

      case "integrity_passed":
        // Integrity is evaluated from business_case context, not repositories
        return {
          condition,
          passed: true,
          reason: "Integrity evaluated at runtime by JourneyOrchestrator",
        };

      case "custom":
        return {
          condition,
          passed: false,
          reason: `Custom condition '${condition.id}' requires explicit resolution`,
        };

      default:
        return {
          condition,
          passed: false,
          reason: `Unknown condition type: ${condition.type}`,
        };
    }
  }

  /**
   * Evaluate multiple conditions in parallel.
   */
  async evaluateAll(
    conditions: PhaseExitCondition[],
    context: {
      organization_id: string;
      opportunity_id?: string;
      case_id?: string;
    }
  ): Promise<ExitConditionEvaluation[]> {
    const evaluations = await Promise.all(
      conditions.map((c) => this.evaluate(c, context))
    );
    return evaluations;
  }

  // ─── Private Evaluation Methods ─────────────────────────────────────

  private async evaluateMinItems(
    condition: PhaseExitCondition,
    context: {
      organization_id: string;
      opportunity_id?: string;
      case_id?: string;
    }
  ): Promise<ExitConditionEvaluation> {
    const targetType = condition.target_type ?? "unknown";
    const threshold = condition.threshold ?? 1;

    try {
      const count = await this.repositories.countItems({
        organization_id: context.organization_id,
        opportunity_id: context.opportunity_id,
        case_id: context.case_id,
        item_type: targetType,
      });

      const passed = count >= threshold;

      return {
        condition,
        passed,
        reason: passed
          ? undefined
          : `Found ${count} ${targetType}(s), need at least ${threshold}`,
        details: { count, threshold, target_type: targetType },
      };
    } catch (error) {
      logger.error("ExitConditionEvaluator.evaluateMinItems failed", {
        condition_id: condition.id,
        target_type: targetType,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        condition,
        passed: false,
        reason: "Failed to query item count",
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private async evaluateAllFieldsPopulated(
    condition: PhaseExitCondition,
    context: {
      organization_id: string;
      opportunity_id?: string;
      case_id?: string;
    }
  ): Promise<ExitConditionEvaluation> {
    // Default required fields based on phase context
    // In production, these would be configured per-tenant or per-phase
    const requiredFields = condition.target_type
      ? [condition.target_type] // If target_type provided, use as single field
      : [
          "baseline_metrics",
          "cost_structure",
          "value_drivers",
          "impact_cascades",
        ];

    try {
      const result = await this.repositories.checkFieldsPopulated({
        organization_id: context.organization_id,
        opportunity_id: context.opportunity_id,
        case_id: context.case_id,
        required_fields: requiredFields,
      });

      return {
        condition,
        passed: result.all_populated,
        reason: result.all_populated
          ? undefined
          : `Missing required fields: ${result.missing_fields.join(", ")}`,
        details: {
          missing_fields: result.missing_fields,
          required_fields: requiredFields,
        },
      };
    } catch (error) {
      logger.error("ExitConditionEvaluator.evaluateAllFieldsPopulated failed", {
        condition_id: condition.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        condition,
        passed: false,
        reason: "Failed to check field population",
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Repository Adapter Implementation
// ---------------------------------------------------------------------------

import { supabase } from "../../lib/supabase.js";

/**
 * Concrete implementation of ExitConditionRepositoryContext using Supabase.
 * This adapter maps abstract exit condition queries to actual table queries.
 */
export class SupabaseExitConditionRepository implements ExitConditionRepositoryContext {
  async countItems(params: {
    organization_id: string;
    opportunity_id?: string;
    case_id?: string;
    item_type: string;
  }): Promise<number> {
    const { organization_id, opportunity_id, case_id, item_type } = params;

    // Map item_type to actual table queries
    switch (item_type) {
      case "value_hypothesis":
      case "hypothesis": {
        const { data, error } = await supabase
          .from("value_hypotheses")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization_id)
          .eq(opportunity_id ? "opportunity_id" : "id", opportunity_id ?? "never");
        if (error) throw error;
        return data?.length ?? 0;
      }

      case "assumption":
      case "assumptions": {
        const query = supabase
          .from("assumptions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization_id);
        if (opportunity_id) {
          query.eq("opportunity_id", opportunity_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data?.length ?? 0;
      }

      case "evidence":
      case "evidence_items": {
        const query = supabase
          .from("evidence")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization_id);
        if (opportunity_id) {
          query.eq("opportunity_id", opportunity_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data?.length ?? 0;
      }

      case "business_case":
      case "case": {
        const { data, error } = await supabase
          .from("business_cases")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization_id)
          .eq("opportunity_id", opportunity_id ?? "never");
        if (error) throw error;
        return data?.length ?? 0;
      }

      case "value_tree_node":
      case "value_tree": {
        const query = supabase
          .from("value_tree_nodes")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization_id);
        if (case_id) {
          query.eq("case_id", case_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data?.length ?? 0;
      }

      default:
        logger.warn("SupabaseExitConditionRepository: unknown item_type", {
          item_type,
        });
        return 0;
    }
  }

  async checkFieldsPopulated(params: {
    organization_id: string;
    opportunity_id?: string;
    case_id?: string;
    required_fields: string[];
  }): Promise<{ all_populated: boolean; missing_fields: string[] }> {
    const { organization_id, opportunity_id, case_id, required_fields } = params;
    const missing_fields: string[] = [];

    // Check each required field by querying the relevant tables
    for (const field of required_fields) {
      const populated = await this.isFieldPopulated(
        field,
        organization_id,
        opportunity_id,
        case_id
      );
      if (!populated) {
        missing_fields.push(field);
      }
    }

    return {
      all_populated: missing_fields.length === 0,
      missing_fields,
    };
  }

  private async isFieldPopulated(
    field: string,
    organization_id: string,
    opportunity_id?: string,
    case_id?: string
  ): Promise<boolean> {
    switch (field) {
      case "baseline_metrics": {
        const { data, error } = await supabase
          .from("opportunities")
          .select("baseline_data")
          .eq("organization_id", organization_id)
          .eq("id", opportunity_id ?? "never")
          .single();
        if (error) return false;
        return data?.baseline_data != null && Object.keys(data.baseline_data).length > 0;
      }

      case "cost_structure": {
        const { data, error } = await supabase
          .from("assumptions")
          .select("id")
          .eq("organization_id", organization_id)
          .eq("opportunity_id", opportunity_id ?? "never")
          .ilike("name", "%cost%")
          .limit(1);
        if (error) return false;
        return (data?.length ?? 0) > 0;
      }

      case "value_drivers": {
        const { data, error } = await supabase
          .from("value_hypotheses")
          .select("id")
          .eq("organization_id", organization_id)
          .eq("opportunity_id", opportunity_id ?? "never")
          .limit(1);
        if (error) return false;
        return (data?.length ?? 0) > 0;
      }

      case "impact_cascades": {
        const { data, error } = await supabase
          .from("value_hypotheses")
          .select("id, impact_cascade")
          .eq("organization_id", organization_id)
          .eq("opportunity_id", opportunity_id ?? "never");
        if (error) return false;
        return (
          (data?.some((h) => h.impact_cascade != null && Object.keys(h.impact_cascade).length > 0) ??
            false)
        );
      }

      case "financial_model": {
        const { data, error } = await supabase
          .from("financial_models")
          .select("id")
          .eq("organization_id", organization_id)
          .eq("case_id", case_id ?? "never")
          .limit(1);
        if (error) return false;
        return (data?.length ?? 0) > 0;
      }

      case "narrative": {
        const { data, error } = await supabase
          .from("narrative_drafts")
          .select("id")
          .eq("organization_id", organization_id)
          .eq("case_id", case_id ?? "never")
          .limit(1);
        if (error) return false;
        return (data?.length ?? 0) > 0;
      }

      default:
        // Unknown fields are considered not populated
        return false;
    }
  }
}
