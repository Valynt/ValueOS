/**
 * HypothesisOutputService
 *
 * Persists and retrieves OpportunityAgent results from the
 * hypothesis_outputs table. All queries are scoped to organization_id.
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { supabase } from "../../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const HypothesisOutputInsertSchema = z.object({
  case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  agent_run_id: z.string().uuid().optional(),
  hypotheses: z.array(z.unknown()),
  kpis: z.array(z.unknown()).default([]),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  reasoning: z.string().optional(),
  hallucination_check: z.boolean().optional(),
});

export type HypothesisOutputInsert = z.infer<typeof HypothesisOutputInsertSchema>;

export interface HypothesisOutputRow {
  id: string;
  case_id: string;
  organization_id: string;
  agent_run_id: string | null;
  hypotheses: unknown[];
  kpis: unknown[];
  confidence: "high" | "medium" | "low" | null;
  reasoning: string | null;
  hallucination_check: boolean | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class HypothesisOutputService {
  /**
   * Persist a new hypothesis output row.
   * Returns the created row id.
   */
  async create(input: HypothesisOutputInsert): Promise<string> {
    const validated = HypothesisOutputInsertSchema.parse(input);

    const { data, error } = await supabase
      .from("hypothesis_outputs")
      .insert({
        case_id: validated.case_id,
        organization_id: validated.organization_id,
        agent_run_id: validated.agent_run_id ?? null,
        hypotheses: validated.hypotheses,
        kpis: validated.kpis,
        confidence: validated.confidence ?? null,
        reasoning: validated.reasoning ?? null,
        hallucination_check: validated.hallucination_check ?? null,
      })
      .select("id")
      .single();

    if (error) {
      logger.error("HypothesisOutputService.create failed", {
        case_id: validated.case_id,
        organization_id: validated.organization_id,
        error: error.message,
      });
      throw new Error(`Failed to persist hypothesis output: ${error.message}`);
    }

    logger.info("Hypothesis output persisted", {
      id: data.id,
      case_id: validated.case_id,
      organization_id: validated.organization_id,
    });

    return data.id as string;
  }

  /**
   * Fetch the latest hypothesis output for a case.
   * Returns null if none exists.
   */
  async getLatestForCase(
    caseId: string,
    organizationId: string,
  ): Promise<HypothesisOutputRow | null> {
    const { data, error } = await supabase
      .from("hypothesis_outputs")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("HypothesisOutputService.getLatestForCase failed", {
        case_id: caseId,
        organization_id: organizationId,
        error: error.message,
      });
      throw new Error(`Failed to fetch hypothesis output: ${error.message}`);
    }

    return data as HypothesisOutputRow | null;
  }

  /**
   * List all hypothesis outputs for a case, newest first.
   */
  async listForCase(
    caseId: string,
    organizationId: string,
  ): Promise<HypothesisOutputRow[]> {
    const { data, error } = await supabase
      .from("hypothesis_outputs")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("HypothesisOutputService.listForCase failed", {
        case_id: caseId,
        organization_id: organizationId,
        error: error.message,
      });
      throw new Error(`Failed to list hypothesis outputs: ${error.message}`);
    }

    return (data ?? []) as HypothesisOutputRow[];
  }
}

export const hypothesisOutputService = new HypothesisOutputService();
