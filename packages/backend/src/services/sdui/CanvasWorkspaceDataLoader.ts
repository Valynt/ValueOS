import {
  WorkspaceContext,
  WorkspaceData,
  WorkspaceState,
} from "../../types/sdui-integration";
import { OutcomeHypothesis } from "../../types/sof";
import { EXTENDED_STRUCTURAL_PERSONA_MAPS } from "../../types/structural-data";
import { VMRTAssumption } from "../../types/vmrt";
import { FormulaResult, ManifestoValidationResult } from "../../types/vos";
import { ROIModel, ROIModelCalculation } from "../../types/vos";
import { ALL_VMRT_SEEDS } from "../../types/vos-pt1-seed";
import { LifecycleStage } from "../../types/workflow";
import { logger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../lib/supabase.js";

import { ROIFormulaInterpreter } from "../ROIFormulaInterpreter.js";
import { ValueFabricService } from "./ValueFabricService.js";

export class CanvasWorkspaceDataLoader {
  constructor(
    private readonly _valueFabricService?: ValueFabricService
  ) {}

  async detectWorkspaceState(
    workspaceId: string,
    context: WorkspaceContext
  ): Promise<WorkspaceState> {
    try {
      const lifecycleStage = await this.determineLifecycleStage(workspaceId, context);
      const workflowExecution = await this.getCurrentWorkflowExecution(workspaceId);

      const state: WorkspaceState = {
        workspace_id: workspaceId,
        workspaceId,
        lifecycle_stage: lifecycleStage,
        lifecycleStage,
        current_view: lifecycleStage,
        currentWorkflowId: workflowExecution?.workflow_definition_id,
        currentStageId: workflowExecution?.current_stage || undefined,
        data: {} as WorkspaceData,
        ui_state: {
          loading: false,
          errors: [],
          notifications: [],
        } as unknown as import("../../types/sdui-integration").UIState,
        validation_state: {
          is_valid: true,
          errors: [],
          warnings: [],
        } as unknown as import("../../types/sdui-integration").ValidationState,
        sync_status: {
          synced: true,
          last_sync: new Date().toISOString(),
        } as unknown as import("../../types/sdui-integration").SyncStatus,
        metadata: {
          ...context.metadata,
          userId: context.userId ?? context.user_id,
          sessionId: context.sessionId ?? context.session_id,
        },
        last_updated: new Date().toISOString(),
        version: 1,
      };

      logger.debug("Detected workspace state", {
        workspaceId,
        lifecycleStage,
        hasWorkflow: !!workflowExecution,
      });

      return state;
    } catch (error) {
      logger.error("Failed to detect workspace state", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        workspace_id: workspaceId,
        workspaceId,
        lifecycle_stage:
          context.lifecycleStage ?? context.lifecycle_stage ?? "opportunity",
        lifecycleStage:
          context.lifecycleStage ?? context.lifecycle_stage ?? "opportunity",
        current_view: "opportunity",
        data: {} as WorkspaceData,
        ui_state: {
          loading: false,
          errors: [],
          notifications: [],
        } as unknown as import("../../types/sdui-integration").UIState,
        validation_state: {
          is_valid: true,
          errors: [],
          warnings: [],
        } as unknown as import("../../types/sdui-integration").ValidationState,
        sync_status: {
          synced: true,
          last_sync: new Date().toISOString(),
        } as unknown as import("../../types/sdui-integration").SyncStatus,
        metadata: context.metadata || {},
        last_updated: new Date().toISOString(),
        version: 1,
      };
    }
  }

  async fetchWorkspaceData(state: WorkspaceState): Promise<WorkspaceData> {
    try {
      logger.debug("Fetching workspace data", {
        workspaceId: state.workspaceId,
        lifecycleStage: state.lifecycleStage,
      });

      const wsId = state.workspaceId ?? state.workspace_id;
      const data: Record<string, unknown> = {
        businessCase: null,
        systemMap: null,
        valueTree: null,
        kpis: [],
        interventions: [],
        feedbackLoops: [],
        personas: [],
      };

      const userId = state.metadata?.userId as string | undefined;
      data.businessCase = await this.fetchBusinessCase(wsId, userId);

      switch (state.lifecycleStage ?? state.lifecycle_stage) {
        case "opportunity":
          data.systemMap = await this.fetchSystemMap(wsId);
          data.personas = await this.fetchPersonas(wsId);
          data.kpis = await this.fetchKPIs(wsId);
          break;
        case "target":
          data.systemMap = await this.fetchSystemMap(wsId);
          data.interventions = await this.fetchInterventions(wsId);
          data.outcomeHypotheses = await this.fetchOutcomeHypotheses(wsId);
          data.kpis = await this.fetchKPIs(wsId);
          break;
        case "expansion":
          data.valueTree = await this.fetchValueTree(wsId);
          data.kpis = await this.fetchKPIs(wsId);
          data.gaps = await this.fetchGaps(wsId);
          data.roi = await this.fetchROI(wsId);
          break;
        case "integrity":
          data.manifestoResults = await this.fetchManifestoResults(wsId);
          data.assumptions = await this.fetchAssumptions(wsId, data.businessCase as Record<string, unknown> | undefined);
          break;
        case "realization":
          data.feedbackLoops = await this.fetchFeedbackLoops(wsId);
          data.realizationData = await this.fetchRealizationMetrics(wsId);
          data.kpis = await this.fetchKPIs(wsId);
          break;
      }

      logger.debug("Fetched workspace data", {
        workspaceId: state.workspaceId,
        hasBusinessCase: !!data.businessCase,
        hasSystemMap: !!data.systemMap,
        kpiCount: Array.isArray(data.kpis) ? data.kpis.length : 0,
      });

      return data as WorkspaceData;
    } catch (error) {
      logger.error("Failed to fetch workspace data", {
        workspaceId: state.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        businessCase: null,
        systemMap: null,
        valueTree: null,
        kpis: [],
        interventions: [],
        feedbackLoops: [],
      } as WorkspaceData;
    }
  }

  private async determineLifecycleStage(
    _workspaceId: string,
    context: WorkspaceContext
  ): Promise<LifecycleStage> {
    const stage = context.lifecycleStage ?? context.lifecycle_stage;
    if (stage) {
      return stage as LifecycleStage;
    }

    return "opportunity";
  }

  private async getCurrentWorkflowExecution(
    _workspaceId: string
  ): Promise<any | null> {
    return null;
  }

  private async fetchBusinessCase(
    workspaceId: string,
    userId?: string
  ): Promise<any | null> {
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("business_cases")
        .select(`
          id,
          name,
          client,
          description,
          status,
          created_at,
          updated_at,
          metadata,
          owner_id
        `)
        .eq("id", workspaceId);

      if (userId) {
        query = query.eq("owner_id", userId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) {
        logger.warn("Error fetching business case", {
          workspaceId,
          error: error.message,
        });
        return null;
      }

      if (!data) {
        const { data: vcData, error: vcError } = await supabase
          .from("value_cases")
          .select(`
            id,
            name,
            description,
            status,
            created_at,
            updated_at,
            metadata,
            company_profiles (
              company_name
            )
          `)
          .eq("id", workspaceId)
          .maybeSingle();

        if (vcError || !vcData) {
          logger.debug("Business case not found in either table", {
            workspaceId,
          });
          return null;
        }

        return {
          id: vcData.id,
          name: vcData.name,
          description: vcData.description,
          company:
            vcData.company_profiles?.[0]?.company_name || "Unknown Company",
          stage: vcData.metadata?.stage || "opportunity",
          status: vcData.status,
          created_at: vcData.created_at,
          updated_at: vcData.updated_at,
          metadata: vcData.metadata || {},
        };
      }

      return {
        id: data.id,
        name: data.name,
        description: data.metadata?.description || data.description,
        company: data.client,
        stage: data.metadata?.stage || "opportunity",
        status: data.status === "presented" ? "completed" : "in-progress",
        created_at: data.created_at,
        updated_at: data.updated_at,
        metadata: data.metadata || {},
      };
    } catch (error) {
      logger.error("Failed to fetch business case", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async fetchSystemMap(workspaceId: string): Promise<any | null> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("system_maps")
        .select("*")
        .eq("business_case_id", workspaceId)
        .maybeSingle();

      if (error) {
        logger.warn("Error fetching system map", {
          workspaceId,
          error: error.message,
        });
        return null;
      }

      return data;
    } catch (error) {
      logger.error("Failed to fetch system map", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async fetchPersonas(workspaceId: string): Promise<any[]> {
    try {
      const businessCase = await this.fetchBusinessCase(workspaceId);

      if (
        businessCase?.metadata?.stakeholders &&
        Array.isArray(businessCase.metadata.stakeholders)
      ) {
        return businessCase.metadata.stakeholders;
      }

      if (
        businessCase?.metadata?.personas &&
        Array.isArray(businessCase.metadata.personas)
      ) {
        return businessCase.metadata.personas;
      }

      return Object.entries(EXTENDED_STRUCTURAL_PERSONA_MAPS).map(([key, p]) => ({
        id: key,
        name: this.formatPersonaName(key),
        role: key,
        primaryPain: p.primaryPain as string | undefined,
        painDescription: p.painDescription as string | undefined,
        keyKPIs: p.keyKPIs as string[] | undefined,
        financialDriver: p.financialDriver as string | undefined,
        typicalGoals: p.typicalGoals as string[] | undefined,
        communicationPreference: p.communicationPreference as string | undefined,
      }));
    } catch (error) {
      logger.error("Failed to fetch personas", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private formatPersonaName(key: string): string {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private async fetchKPIs(workspaceId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();
      const { data: commit } = await supabase
        .from("value_commits")
        .select("id")
        .eq("value_case_id", workspaceId)
        .eq("status", "active")
        .maybeSingle();

      if (commit) {
        const { data: targets, error: targetError } = await supabase
          .from("kpi_targets")
          .select("*")
          .eq("value_commit_id", commit.id);

        if (!targetError && targets && targets.length > 0) {
          return targets.map((t) => ({
            id: t.id,
            kpi_name: t.kpi_name,
            baseline_value: t.baseline_value,
            target_value: t.target_value,
            unit: t.unit,
            confidence_level: t.confidence_level,
            source: "target",
            created_at: t.created_at,
          }));
        }
      }

      const { data: hypotheses, error: hypoError } = await supabase
        .from("kpi_hypotheses")
        .select("*")
        .eq("value_case_id", workspaceId);

      if (hypoError) {
        logger.warn("Error fetching KPI hypotheses", {
          workspaceId,
          error: hypoError.message,
        });
        return [];
      }

      return (hypotheses || []).map((h) => ({
        id: h.id,
        kpi_name: h.kpi_name,
        baseline_value: h.baseline_value,
        target_value: h.target_value,
        unit: h.unit,
        confidence_level: h.confidence_level,
        source: "hypothesis",
        created_at: h.created_at,
      }));
    } catch (error) {
      logger.error("Failed to fetch KPIs", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchInterventions(workspaceId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();
      const { data: systemMap, error: mapError } = await supabase
        .from("system_maps")
        .select("id")
        .eq("business_case_id", workspaceId)
        .maybeSingle();

      if (mapError) {
        logger.warn("Error fetching system map for interventions", {
          workspaceId,
          error: mapError.message,
        });
        return [];
      }

      if (!systemMap) {
        logger.debug("No system map found for workspace", { workspaceId });
        return [];
      }

      const { data: interventions, error: intError } = await supabase
        .from("intervention_points")
        .select("*")
        .eq("system_map_id", systemMap.id)
        .order("created_at", { ascending: false });

      if (intError) {
        logger.error("Error fetching interventions", {
          workspaceId,
          error: intError.message,
        });
        return [];
      }

      return interventions || [];
    } catch (error) {
      logger.error("Failed to fetch interventions", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchOutcomeHypotheses(
    workspaceId: string
  ): Promise<OutcomeHypothesis[]> {
    try {
      const supabase = getSupabaseClient();
      const { data: systemMap, error: systemMapError } = await supabase
        .from("system_maps")
        .select("id")
        .eq("business_case_id", workspaceId)
        .maybeSingle();

      if (systemMapError) {
        logger.error("Error resolving system map for outcomes", {
          workspaceId,
          error: systemMapError.message,
        });
        return [];
      }

      if (!systemMap) {
        return [];
      }

      const { data, error } = await supabase
        .from("outcome_hypotheses")
        .select("*")
        .eq("system_map_id", systemMap.id)
        .order("created_at", { ascending: true });

      if (error) {
        logger.error("Error fetching outcome hypotheses", {
          workspaceId,
          error: error.message,
        });
        return [];
      }

      return (data as OutcomeHypothesis[]) || [];
    } catch (error) {
      logger.error("Unexpected error in fetchOutcomeHypotheses", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchValueTree(workspaceId: string): Promise<any | null> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("value_trees")
        .select(`
          *,
          value_tree_nodes(*),
          value_tree_links(*)
        `)
        .eq("value_case_id", workspaceId)
        .maybeSingle();

      if (error) {
        logger.error("Error fetching value tree", {
          workspaceId,
          error: error.message,
        });
        return null;
      }

      if (!data) return null;

      return {
        ...data,
        nodes: data.value_tree_nodes || [],
        links: data.value_tree_links || [],
      };
    } catch (error) {
      logger.error("Failed to fetch value tree", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async fetchGaps(workspaceId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();
      const { data: opportunities, error } = await supabase
        .from("opportunities")
        .select(
          "id, title, type, gap_analysis, current_state, desired_state, impact_score"
        )
        .eq("value_case_id", workspaceId)
        .not("gap_analysis", "is", null);

      if (error) {
        logger.warn("Error fetching gaps from opportunities", {
          workspaceId,
          error: error.message,
        });
        return [];
      }

      return (opportunities || []).map((opp) => ({
        id: opp.id,
        name: opp.title,
        type: opp.type,
        gap_analysis: opp.gap_analysis,
        current_state: opp.current_state,
        desired_state: opp.desired_state,
        impact_score: opp.impact_score,
      }));
    } catch (error) {
      logger.error("Failed to fetch gaps", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchROI(workspaceId: string): Promise<{
    model: ROIModel;
    calculations: ROIModelCalculation[];
    results: Record<string, FormulaResult>;
  } | null> {
    try {
      const supabase = getSupabaseClient();
      const { data: roiModel, error: rmError } = await supabase
        .from("roi_models")
        .select(`
          *,
          roi_model_calculations (*),
          value_trees!inner (
            value_case_id
          )
        `)
        .eq("value_trees.value_case_id", workspaceId)
        .maybeSingle();

      if (rmError || !roiModel) {
        logger.debug("ROI Model not found", { workspaceId });
        return null;
      }

      const calculations = (roiModel.roi_model_calculations || []).sort(
        (a: ROIModelCalculation, b: ROIModelCalculation) =>
          new Date(a.calculation_date).getTime() -
          new Date(b.calculation_date).getTime()
      );

      const interpreter = new ROIFormulaInterpreter(supabase);
      const context = await interpreter.createContextFromKPIs(workspaceId);
      const results = await interpreter.executeCalculationSequence(
        calculations,
        context
      );

      return {
        model: roiModel as unknown as ROIModel,
        calculations,
        results,
      };
    } catch (error) {
      logger.error("Failed to fetch ROI", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async fetchManifestoResults(
    workspaceId: string
  ): Promise<ManifestoValidationResult[]> {
    try {
      const supabase = getSupabaseClient();
      const results: ManifestoValidationResult[] = [];

      const collectResults = (
        artifacts: Array<{
          compliance_metadata?: { results?: ManifestoValidationResult[] };
        }>
      ) => {
        if (!artifacts) return;
        artifacts.forEach((artifact) => {
          if (
            artifact.compliance_metadata &&
            artifact.compliance_metadata.results
          ) {
            results.push(...artifact.compliance_metadata.results);
          }
        });
      };

      const { data: valueTrees } = await supabase
        .from("value_trees")
        .select("id, compliance_metadata")
        .eq("value_case_id", workspaceId);
      collectResults(valueTrees || []);

      if (valueTrees && valueTrees.length > 0) {
        const valueTreeIds = valueTrees.map((vt) => vt.id);
        const { data: roiModels } = await supabase
          .from("roi_models")
          .select("id, compliance_metadata")
          .in("value_tree_id", valueTreeIds);
        collectResults(roiModels || []);
      }

      const { data: valueCommits } = await supabase
        .from("value_commits")
        .select("id, compliance_metadata")
        .eq("value_case_id", workspaceId);
      collectResults(valueCommits || []);

      const { data: realizationReports } = await supabase
        .from("realization_reports")
        .select("id, compliance_metadata")
        .eq("value_case_id", workspaceId);
      collectResults(realizationReports || []);

      const { data: expansionModels } = await supabase
        .from("expansion_models")
        .select("id, compliance_metadata")
        .eq("value_case_id", workspaceId);
      collectResults(expansionModels || []);

      logger.debug("Fetched manifesto results", {
        workspaceId,
        count: results.length,
      });

      return results;
    } catch (error) {
      logger.error("Failed to fetch manifesto results", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchAssumptions(
    workspaceId: string,
    businessCase?: Record<string, unknown>
  ): Promise<VMRTAssumption[]> {
    try {
      const supabase = getSupabaseClient();
      const { data: modelData } = await supabase
        .from("models")
        .select("model_data")
        .contains("model_data", { business_case_id: workspaceId })
        .maybeSingle();

      if (
        modelData?.model_data?.assumptions &&
        Array.isArray(modelData.model_data.assumptions)
      ) {
        return modelData.model_data.assumptions;
      }

      const industry = businessCase?.metadata?.industry;
      let relevantTraces = ALL_VMRT_SEEDS;

      if (industry) {
        const industryTraces = ALL_VMRT_SEEDS.filter((t) => {
          const org = t.context?.organization as
            | Record<string, unknown>
            | undefined;
          return (
            org?.industry?.toString().toLowerCase() === industry.toLowerCase()
          );
        });
        if (industryTraces.length > 0) {
          relevantTraces = industryTraces;
        }
      }

      const assumptions: VMRTAssumption[] = relevantTraces.flatMap(
        (trace) =>
          trace.reasoningSteps?.flatMap((step) => {
            const s = step as Record<string, unknown>;
            return (s.assumptions as VMRTAssumption[] | undefined) || [];
          }) || []
      );

      return Array.from(
        assumptions
          .reduce((map, assumption) => {
            const existing = map.get(assumption.id);
            if (!existing || assumption.confidence > existing.confidence) {
              map.set(assumption.id, assumption);
            }
            return map;
          }, new Map<string, VMRTAssumption>())
          .values()
      );
    } catch (error) {
      logger.error("Failed to fetch assumptions", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchFeedbackLoops(workspaceId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();
      const { data: systemMap, error: mapError } = await supabase
        .from("system_maps")
        .select("id")
        .eq("business_case_id", workspaceId)
        .maybeSingle();

      if (mapError || !systemMap) {
        return [];
      }

      const { data: loops, error: loopError } = await supabase
        .from("feedback_loops")
        .select("*")
        .eq("system_map_id", systemMap.id);

      if (loopError) {
        logger.warn("Error fetching feedback loops", {
          workspaceId,
          error: loopError.message,
        });
        return [];
      }

      return loops || [];
    } catch (error) {
      logger.error("Failed to fetch feedback loops", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchRealizationMetrics(workspaceId: string): Promise<{
    implementationStatus: string;
    observedChanges: unknown[];
    kpiMeasurements: Record<string, unknown>[];
  } | null> {
    try {
      const supabase = getSupabaseClient();
      const { data: report } = await supabase
        .from("realization_reports")
        .select("*")
        .eq("value_case_id", workspaceId)
        .order("report_period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      let implementationStatus = "planning";
      let kpiMeasurements: Record<string, unknown>[] = [];

      if (report) {
        const statusMap: Record<string, string> = {
          on_track: "implementing",
          at_risk: "implementing",
          achieved: "completed",
          missed: "completed",
        };
        implementationStatus = statusMap[report.overall_status] || "planning";

        const { data: results } = await supabase
          .from("realization_results")
          .select("*")
          .eq("realization_report_id", report.id);

        if (results) {
          kpiMeasurements = results;
        }
      }

      const feedbackLoops = await this.fetchFeedbackLoops(workspaceId);
      const observedChanges = feedbackLoops.flatMap(
        (loop) => loop.behavior_changes || []
      );

      return {
        implementationStatus,
        observedChanges,
        kpiMeasurements,
      };
    } catch (error) {
      logger.error("Failed to fetch realization metrics", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
