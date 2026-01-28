/**
 * Customer Portal API - Value Case Endpoint
 * GET /api/customer/value-case/:token
 */

import { Request, Response } from "express";
import { customerAccessService } from "../../services/CustomerAccessService";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@shared/lib/logger";
import { z } from "zod";
import { ValueTreeService } from "../../services/value/ValueTreeService";
import { RoiModelService } from "../../services/value/RoiModelService";
import { KpiTargetService } from "../../services/value/KpiTargetService";

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
export async function getCustomerValueCase(req: Request, res: Response): Promise<void> {
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
    // tenant_id is not returned by token validation, so fetch value case row for tenant_id and details
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const valueTreeService = new ValueTreeService(supabaseClient);
    const roiModelService = new RoiModelService(supabaseClient);
    const kpiTargetService = new KpiTargetService(supabaseClient);
    // Fetch value case row for tenant_id and details
    const valueCaseRow = await supabaseClient
      .from("value_cases")
      .select(
        "id, tenant_id, name, company_name, description, lifecycle_stage, status, buyer_persona, persona_fit_score, created_at, updated_at"
      )
      .eq("id", valueCaseId)
      .single();
    if (valueCaseRow.error || !valueCaseRow.data) {
      res.status(404).json({ error: "Value case not found" });
      return;
    }
    const tenantId = valueCaseRow.data.tenant_id;
    // Fetch value tree
    const valueTree = await valueTreeService.getByValueCase(tenantId, valueCaseId);
    // Fetch ROI model
    const roiModel = await roiModelService.getByValueCase(tenantId, valueCaseId);
    // Fetch derived KPIs
    const kpiTargets = await kpiTargetService.deriveForValueCase(tenantId, valueCaseId);
    // Build response (adapt as needed)
    const response: ValueCaseResponse = {
      id: valueCaseId,
      name: valueCaseRow.data.name || valueTree.nodes[0]?.label || "",
      company_name: valueCaseRow.data.company_name || "",
      description: valueCaseRow.data.description || "",
      lifecycle_stage: valueCaseRow.data.lifecycle_stage || "",
      status: valueCaseRow.data.status || "",
      buyer_persona: valueCaseRow.data.buyer_persona || null,
      persona_fit_score: valueCaseRow.data.persona_fit_score || null,
      created_at: valueCaseRow.data.created_at || "",
      updated_at: valueCaseRow.data.updated_at || "",
      opportunities: [], // TODO: fetch if needed
      value_drivers: (
        valueTree.nodes as Array<{ id: string; label: string; driverType: string; value?: number }>
      ).map((n) => ({
        id: n.id,
        name: n.label,
        category: n.driverType,
        baseline_value: n.value ?? 0,
        target_value: 0, // TODO: derive if needed
        unit: "", // TODO: derive if needed
      })),
      financial_summary: {
        roi: roiModel.outputs["roi"] ?? null,
        npv: roiModel.outputs["npv"] ?? null,
        payback_period_months: roiModel.outputs["payback_period_months"] ?? null,
      },
      warnings: [],
    };
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
    logger.error("Error in getCustomerValueCase", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  }
}
