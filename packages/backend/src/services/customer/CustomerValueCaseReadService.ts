import { createLogger } from "@shared/lib/logger";

// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from "../../lib/supabase.js";
import { customerAccessService } from "../tenant/CustomerAccessService";
import { KpiTargetService } from "../value/KpiTargetService";
import { RoiModelService } from "../value/RoiModelService";
import { ValueTreeService } from "../value/ValueTreeService";

const logger = createLogger({ component: "CustomerValueCaseReadService" });

export type CustomerValueCaseView = {
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
};

export class CustomerValueCaseReadService {
  private readonly supabase = createServerSupabaseClient();
  private readonly valueTreeService = new ValueTreeService(this.supabase);
  private readonly roiModelService = new RoiModelService(this.supabase);
  private readonly kpiTargetService = new KpiTargetService(this.supabase);

  async readByCustomerToken(token: string): Promise<
    | { status: "unauthorized"; message: string }
    | { status: "not_found" }
    | { status: "ok"; response: CustomerValueCaseView }
  > {
    const validation = await customerAccessService.validateCustomerToken(token);
    if (!validation.is_valid || !validation.value_case_id) {
      logger.warn("Customer value case token rejected", { tokenPreview: token.slice(0, 8) });
      return {
        status: "unauthorized",
        message: validation.error_message || "Invalid token",
      };
    }

    const valueCaseId = validation.value_case_id;
    const valueCaseRow = await this.supabase
      .from("value_cases")
      .select(
        "id, tenant_id, name, company_name, description, lifecycle_stage, status, buyer_persona, persona_fit_score, created_at, updated_at"
      )
      .eq("id", valueCaseId)
      .single();

    if (valueCaseRow.error || !valueCaseRow.data) {
      logger.warn("Customer value case lookup missed", { valueCaseId, error: valueCaseRow.error?.message });
      return { status: "not_found" };
    }

    const tenantId = valueCaseRow.data.tenant_id;
    const valueTree = await this.valueTreeService.getByValueCase(tenantId, valueCaseId);
    const roiModel = await this.roiModelService.getByValueCase(tenantId, valueCaseId);
    const kpiTargets = await this.kpiTargetService.deriveForValueCase(tenantId, valueCaseId);
    const opportunitiesResult = await this.supabase
      .from("opportunities")
      .select("id, type, title, description, priority, impact_score")
      .eq("value_case_id", valueCaseId)
      .eq("tenant_id", tenantId);

    return {
      status: "ok",
      response: {
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
        opportunities: (opportunitiesResult.data || []).map((o) => ({
          id: o.id,
          type: o.type,
          title: o.title,
          description: o.description,
          priority: o.priority,
          impact_score: o.impact_score,
        })),
        value_drivers: (
          valueTree.nodes as Array<{ id: string; label: string; driverType: string; value?: number }>
        ).map((n) => {
          const target = kpiTargets.find((t) => t.metric === n.id || t.metric === n.label);
          return {
            id: n.id,
            name: n.label,
            category: n.driverType,
            baseline_value: n.value ?? 0,
            target_value: target?.targetValue ?? 0,
            unit: target?.unit ?? "",
          };
        }),
        financial_summary: {
          roi: roiModel.outputs["roi"] ?? null,
          npv: roiModel.outputs["npv"] ?? null,
          payback_period_months: roiModel.outputs["payback_period_months"] ?? null,
        },
        warnings: [],
      },
    };
  }
}

export const customerValueCaseReadService = new CustomerValueCaseReadService();
