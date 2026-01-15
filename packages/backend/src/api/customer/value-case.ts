/**
 * Customer Portal API - Value Case Endpoint
 * GET /api/customer/value-case/:token
 */

import { Request, Response } from "express";
import { customerAccessService } from "../../services/CustomerAccessService";
import { supabase } from "../../lib/supabase";
import { logger } from "../../lib/logger";
import { z } from "zod";

// Request validation schema
const ValueCaseRequestSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export interface ValueCaseResponse {
  id: string;
  name: string;
  company_name: string;
  description: string | null;
  lifecycle_stage: string;
  status: string;
  buyer_persona: string | null;
  persona_fit_score: number | null;
  created_at: string;
  updated_at: string;
  opportunities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    priority: string;
    impact_score: number;
  }>;
  value_drivers: Array<{
    id: string;
    name: string;
    category: string;
    baseline_value: number;
    target_value: number;
    unit: string;
  }>;
  financial_summary: {
    roi: number | null;
    npv: number | null;
    payback_period_months: number | null;
  } | null;
  warnings?: string[];
}

/**
 * Get value case details for customer portal
 */
export async function getCustomerValueCase(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Validate request parameters
    const { token } = ValueCaseRequestSchema.parse(req.params);

    logger.info("Customer value case request");

    // Validate token
    const validation = await customerAccessService.validateCustomerToken(token);

    if (!validation.is_valid || !validation.value_case_id) {
      res.status(401).json({
        error: "Unauthorized",
        message: validation.error_message || "Invalid token",
      });
      return;
    }

    const valueCaseId = validation.value_case_id;

    // Fetch value case with related data
    const { data: valueCase, error: vcError } = await supabase
      .from("value_cases")
      .select(
        `
        id,
        name,
        company_name,
        description,
        lifecycle_stage,
        status,
        buyer_persona,
        persona_fit_score,
        created_at,
        updated_at
      `
      )
      .eq("id", valueCaseId)
      .single();

    if (vcError || !valueCase) {
      logger.error("Failed to fetch value case", vcError);
      res.status(404).json({
        error: "Not Found",
        message: "Value case not found",
      });
      return;
    }

    // Fetch opportunities
    const { data: opportunities, error: oppError } = await supabase
      .from("opportunities")
      .select("id, type, title, description, priority, impact_score")
      .eq("value_case_id", valueCaseId)
      .order("impact_score", { ascending: false });

    if (oppError) {
      logger.error("Failed to fetch opportunities", oppError);
    }

    // Fetch value drivers
    const { data: valueDrivers, error: vdError } = await supabase
      .from("value_drivers")
      .select("id, name, category, baseline_value, target_value, unit")
      .eq("value_case_id", valueCaseId)
      .order("category");

    if (vdError) {
      logger.error("Failed to fetch value drivers", vdError);
    }

    // Fetch financial model summary
    const { data: financialModel, error: fmError } = await supabase
      .from("financial_models")
      .select("roi, npv, payback_period_months")
      .eq("value_case_id", valueCaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fmError && fmError.code !== "PGRST116") {
      // Ignore "no rows" error
      logger.error("Failed to fetch financial model", fmError);
    }

    // Build response
    const response: ValueCaseResponse = {
      ...valueCase,
      opportunities: opportunities || [],
      value_drivers: valueDrivers || [],
      financial_summary: financialModel || null,
    };

    logger.info("Customer value case retrieved successfully", {
      valueCaseId,
      opportunitiesCount: opportunities?.length || 0,
      valueDriversCount: valueDrivers?.length || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Bad Request",
        message: "Invalid request parameters",
        details: error.errors,
      });
      return;
    }

    logger.error("Error in getCustomerValueCase", error as Error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  }
}
