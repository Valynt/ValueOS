/**
 * DealAssemblyService
 *
 * Handles deal context extraction, stakeholder mapping, gap detection,
 and assembly status management.
 *
 * Reference: openspec/specs/deal-assembly/spec.md
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const StakeholderSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  source: z.string(),
  email: z.string().email().optional(),
  department: z.string().optional(),
});

export const GapSchema = z.object({
  id: z.string(),
  field: z.string(),
  description: z.string(),
  required: z.boolean(),
  resolved: z.boolean().default(false),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  submitted_by: z.string().uuid().optional(),
  submitted_at: z.string().datetime().optional(),
});

export const DealContextSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  account_name: z.string(),
  stakeholders: z.array(StakeholderSchema),
  use_cases: z.array(z.string()),
  pain_signals: z.array(z.string()),
  value_driver_candidates: z.array(z.string()),
  baseline_clues: z.record(z.unknown()),
  gaps: z.array(GapSchema),
  assembly_status: z.enum(["assembling", "confirmed", "needs-review"]),
  extracted_from: z.array(z.string()), // sources
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Stakeholder = z.infer<typeof StakeholderSchema>;
export type Gap = z.infer<typeof GapSchema>;
export type DealContext = z.infer<typeof DealContextSchema>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DealAssemblyService {
  /**
   * Create or update deal context for a case.
   */
  async upsertContext(
    caseId: string,
    organizationId: string,
    data: {
      account_name: string;
      stakeholders: Stakeholder[];
      use_cases: string[];
      pain_signals: string[];
      value_driver_candidates: string[];
      baseline_clues: Record<string, unknown>;
      gaps: Omit<Gap, "resolved" | "value">[];
      extracted_from: string[];
    },
  ): Promise<string> {
    // Check if context exists
    const { data: existing } = await supabase
      .from("deal_contexts")
      .select("id")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .single();

    const gapsWithDefaults = data.gaps.map((g) => ({
      ...g,
      resolved: false,
      id: g.id || crypto.randomUUID(),
    }));

    const contextData = {
      case_id: caseId,
      organization_id: organizationId,
      account_name: data.account_name,
      stakeholders: data.stakeholders,
      use_cases: data.use_cases,
      pain_signals: data.pain_signals,
      value_driver_candidates: data.value_driver_candidates,
      baseline_clues: data.baseline_clues,
      gaps: gapsWithDefaults,
      assembly_status: "assembling" as const,
      extracted_from: data.extracted_from,
    };

    if (existing) {
      const { error } = await supabase
        .from("deal_contexts")
        .update({
          ...contextData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        logger.error("DealAssemblyService.upsertContext update failed", {
          case_id: caseId,
          error: error.message,
        });
        throw new Error(`Failed to update deal context: ${error.message}`);
      }

      logger.info("Deal context updated", { id: existing.id, case_id: caseId });
      return existing.id as string;
    } else {
      const { data: inserted, error } = await supabase
        .from("deal_contexts")
        .insert({
          ...contextData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        logger.error("DealAssemblyService.upsertContext insert failed", {
          case_id: caseId,
          error: error.message,
        });
        throw new Error(`Failed to create deal context: ${error.message}`);
      }

      logger.info("Deal context created", { id: inserted.id, case_id: caseId });
      return inserted.id as string;
    }
  }

  /**
   * Get deal context for a case.
   */
  async getContext(caseId: string, organizationId: string): Promise<DealContext | null> {
    const { data, error } = await supabase
      .from("deal_contexts")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      logger.error("DealAssemblyService.getContext failed", {
        case_id: caseId,
        error: error.message,
      });
      throw new Error(`Failed to fetch deal context: ${error.message}`);
    }

    return data as unknown as DealContext;
  }

  /**
   * Fill a gap with a value.
   */
  async fillGap(
    caseId: string,
    organizationId: string,
    gapId: string,
    value: string | number | boolean,
    submittedBy: string,
  ): Promise<void> {
    const { data: context, error: fetchError } = await supabase
      .from("deal_contexts")
      .select("gaps")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !context) {
      throw new Error(`Deal context not found for case: ${caseId}`);
    }

    const gaps = (context.gaps || []) as Gap[];
    const gapIndex = gaps.findIndex((g) => g.id === gapId);

    if (gapIndex === -1) {
      throw new Error(`Gap not found: ${gapId}`);
    }

    gaps[gapIndex] = {
      ...gaps[gapIndex],
      value,
      resolved: true,
      submitted_by: submittedBy,
      submitted_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("deal_contexts")
      .update({
        gaps,
        updated_at: new Date().toISOString(),
      })
      .eq("case_id", caseId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error("DealAssemblyService.fillGap failed", {
        case_id: caseId,
        gap_id: gapId,
        error: error.message,
      });
      throw new Error(`Failed to fill gap: ${error.message}`);
    }

    logger.info("Gap filled", { case_id: caseId, gap_id: gapId });
  }

  /**
   * Confirm deal assembly and mark ready for modeling.
   */
  async confirmAssembly(caseId: string, organizationId: string): Promise<void> {
    const { data: context, error: fetchError } = await supabase
      .from("deal_contexts")
      .select("gaps")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !context) {
      throw new Error(`Deal context not found for case: ${caseId}`);
    }

    // Check all required gaps are resolved
    const gaps = (context.gaps || []) as Gap[];
    const unresolvedRequired = gaps.filter((g) => g.required && !g.resolved);

    if (unresolvedRequired.length > 0) {
      throw new Error(
        `Cannot confirm: ${unresolvedRequired.length} required gaps unresolved`,
      );
    }

    const { error } = await supabase
      .from("deal_contexts")
      .update({
        assembly_status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("case_id", caseId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error("DealAssemblyService.confirmAssembly failed", {
        case_id: caseId,
        error: error.message,
      });
      throw new Error(`Failed to confirm assembly: ${error.message}`);
    }

    logger.info("Deal assembly confirmed", { case_id: caseId });
  }

  /**
   * Trigger re-assembly (e.g., after new data sources added).
   */
  async triggerReassembly(caseId: string, organizationId: string): Promise<void> {
    const { error } = await supabase
      .from("deal_contexts")
      .update({
        assembly_status: "assembling",
        updated_at: new Date().toISOString(),
      })
      .eq("case_id", caseId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error("DealAssemblyService.triggerReassembly failed", {
        case_id: caseId,
        error: error.message,
      });
      throw new Error(`Failed to trigger reassembly: ${error.message}`);
    }

    // Emit event for agent to re-process
    // TODO: Integrate with event system

    logger.info("Reassembly triggered", { case_id: caseId });
  }
}

export default DealAssemblyService;
