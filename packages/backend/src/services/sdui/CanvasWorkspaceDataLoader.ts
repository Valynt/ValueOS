import { logger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import {
  WorkspaceContext,
  WorkspaceData,
  WorkspaceState,
} from "../../types/sdui-integration";
import { OutcomeHypothesis } from "../../types/sof";
import { EXTENDED_STRUCTURAL_PERSONA_MAPS } from "../../types/structural-data";
import { VMRTAssumption } from "../../types/vmrt";
import {
  FormulaResult,
  ManifestoValidationResult,
  ROIModel,
  ROIModelCalculation,
} from "../../types/vos";
import { ALL_VMRT_SEEDS } from "../../types/vos-pt1-seed";
import { LifecycleStage } from "../../types/workflow";

import { ROIFormulaInterpreter } from "../ROIFormulaInterpreter.js";
import { ValueFabricService } from "./ValueFabricService.js";

const SYSTEM_MAP_SELECT = [
  "id",
  "business_case_id",
  "name",
  "description",
  "entities",
  "relationships",
  "leverage_points",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const VALUE_TREE_SELECT = `
  id,
  value_case_id,
  name,
  description,
  version,
  is_published,
  created_at,
  updated_at,
  compliance_metadata,
  value_tree_nodes (
    id,
    value_tree_id,
    node_id,
    label,
    type,
    reference_id,
    properties,
    position_x,
    position_y,
    created_at
  ),
  value_tree_links (
    parent_id,
    child_id,
    link_type,
    weight,
    metadata
  )
`;

const ROI_MODEL_SELECT = `
  id,
  value_tree_id,
  name,
  description,
  formula,
  parameters,
  assumptions,
  timeframe_months,
  compliance_metadata,
  roi_model_calculations (
    id,
    model_id,
    calculation_date,
    input_parameters,
    roi_percentage,
    payback_period_months,
    net_present_value,
    internal_rate_of_return,
    break_even_analysis,
    sensitivity_analysis
  ),
  value_trees!inner (
    value_case_id
  )
`;

const FEEDBACK_LOOP_SELECT = [
  "id",
  "system_map_id",
  "value_commit_id",
  "agent_type",
  "predicted_value",
  "actual_value",
  "variance_percentage",
  "variance_absolute",
  "recorded_at",
  "recorded_by",
  "notes",
  "behavior_changes",
].join(", ");

const REALIZATION_REPORT_SELECT = [
  "id",
  "value_commit_id",
  "value_case_id",
  "report_period_start",
  "report_period_end",
  "overall_status",
  "executive_summary",
  "generated_at",
  "generated_by",
  "metadata",
  "compliance_metadata",
  "created_at",
].join(", ");

const REALIZATION_RESULT_SELECT = [
  "id",
  "realization_report_id",
  "kpi_target_id",
  "kpi_name",
  "actual_value",
  "target_value",
  "baseline_value",
  "unit",
  "variance",
  "variance_percentage",
  "status",
  "confidence_level",
  "created_at",
].join(", ");

type PersonaBusinessCase = {
  metadata?: {
    stakeholders?: unknown[];
    personas?: unknown[];
    industry?: string;
  };
};

type ManifestoArtifactRow = {
  compliance_metadata?: { results?: ManifestoValidationResult[] };
};

type ValueTreeManifestoRow = ManifestoArtifactRow & {
  id: string;
  roi_models?: ManifestoArtifactRow[];
};

type FeedbackLoopRow = {
  behavior_changes?: unknown[];
};

type CanvasWorkspaceRequestContext = {
  workspaceId: string;
  userId?: string;
  supabase: ReturnType<typeof getSupabaseClient>;
  businessCasePromise?: Promise<any | null>;
  systemMapPromise?: Promise<any | null>;
  systemMapIdPromise?: Promise<string | null>;
  kpisPromise?: Promise<any[]>;
};

export class CanvasWorkspaceDataLoader {
  constructor(private readonly _valueFabricService?: ValueFabricService) {}

  async detectWorkspaceState(
    workspaceId: string,
    context: WorkspaceContext
  ): Promise<WorkspaceState> {
    try {
      const lifecycleStage = await this.determineLifecycleStage(
        workspaceId,
        context
      );
      const workflowExecution =
        await this.getCurrentWorkflowExecution(workspaceId);

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
      const lifecycleStage = state.lifecycleStage ?? state.lifecycle_stage;
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
      const requestContext: CanvasWorkspaceRequestContext = {
        workspaceId: wsId,
        userId,
        supabase: getSupabaseClient(),
      };
      data.businessCase = await this.timedSubFetch(
        wsId,
        `workspace.${lifecycleStage}.businessCase`,
        () => this.fetchBusinessCase(wsId, userId, requestContext),
        { lifecycleStage }
      );

      switch (lifecycleStage) {
        case "opportunity": {
          const [systemMap, personas, kpis] = await Promise.all([
            this.timedSubFetch(wsId, "workspace.opportunity.systemMap", () =>
              this.fetchSystemMap(wsId, requestContext)
            ),
            this.timedSubFetch(wsId, "workspace.opportunity.personas", () =>
              this.fetchPersonas(
                wsId,
                data.businessCase as PersonaBusinessCase | null,
                requestContext
              )
            ),
            this.timedSubFetch(wsId, "workspace.opportunity.kpis", () =>
              this.fetchKPIs(wsId, requestContext)
            ),
          ]);

          data.systemMap = systemMap;
          data.personas = personas;
          data.kpis = kpis;
          break;
        }
        case "target": {
          const systemMapIdPromise = this.fetchSystemMapId(
            wsId,
            requestContext
          );
          const [systemMap, interventions, outcomeHypotheses, kpis] =
            await Promise.all([
              this.timedSubFetch(wsId, "workspace.target.systemMap", () =>
                this.fetchSystemMap(wsId, requestContext)
              ),
              this.timedSubFetch(wsId, "workspace.target.interventions", () =>
                this.fetchInterventions(
                  wsId,
                  systemMapIdPromise,
                  requestContext
                )
              ),
              this.timedSubFetch(
                wsId,
                "workspace.target.outcomeHypotheses",
                () =>
                  this.fetchOutcomeHypotheses(
                    wsId,
                    systemMapIdPromise,
                    requestContext
                  )
              ),
              this.timedSubFetch(wsId, "workspace.target.kpis", () =>
                this.fetchKPIs(wsId, requestContext)
              ),
            ]);

          data.systemMap = systemMap;
          data.interventions = interventions;
          data.outcomeHypotheses = outcomeHypotheses;
          data.kpis = kpis;
          break;
        }
        case "expansion": {
          const [valueTree, kpis, gaps, roi] = await Promise.all([
            this.timedSubFetch(wsId, "workspace.expansion.valueTree", () =>
              this.fetchValueTree(wsId, requestContext)
            ),
            this.timedSubFetch(wsId, "workspace.expansion.kpis", () =>
              this.fetchKPIs(wsId, requestContext)
            ),
            this.timedSubFetch(wsId, "workspace.expansion.gaps", () =>
              this.fetchGaps(wsId, requestContext)
            ),
            this.timedSubFetch(wsId, "workspace.expansion.roi", () =>
              this.fetchROI(wsId, requestContext)
            ),
          ]);

          data.valueTree = valueTree;
          data.kpis = kpis;
          data.gaps = gaps;
          data.roi = roi;
          break;
        }
        case "integrity": {
          const [manifestoResults, assumptions] = await Promise.all([
            this.timedSubFetch(
              wsId,
              "workspace.integrity.manifestoResults",
              () => this.fetchManifestoResults(wsId, requestContext)
            ),
            this.timedSubFetch(wsId, "workspace.integrity.assumptions", () =>
              this.fetchAssumptions(
                wsId,
                data.businessCase as PersonaBusinessCase | undefined,
                requestContext
              )
            ),
          ]);

          data.manifestoResults = manifestoResults;
          data.assumptions = assumptions;
          break;
        }
        case "realization": {
          const systemMapIdPromise = this.fetchSystemMapId(
            wsId,
            requestContext
          );
          const feedbackLoopsPromise = this.timedSubFetch(
            wsId,
            "workspace.realization.feedbackLoops",
            () =>
              this.fetchFeedbackLoops(wsId, systemMapIdPromise, requestContext)
          );
          const [feedbackLoops, realizationData, kpis] = await Promise.all([
            feedbackLoopsPromise,
            this.timedSubFetch(wsId, "workspace.realization.metrics", () =>
              this.fetchRealizationMetrics(
                wsId,
                feedbackLoopsPromise,
                requestContext
              )
            ),
            this.timedSubFetch(wsId, "workspace.realization.kpis", () =>
              this.fetchKPIs(wsId, requestContext)
            ),
          ]);

          data.feedbackLoops = feedbackLoops;
          data.realizationData = realizationData;
          data.kpis = kpis;
          break;
        }
      }

      logger.debug("Fetched workspace data", {
        workspaceId: state.workspaceId,
        lifecycleStage,
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

  private async timedSubFetch<T>(
    workspaceId: string,
    fetchName: string,
    fetcher: () => Promise<T>,
    metadata: Record<string, unknown> = {}
  ): Promise<T> {
    const start = performance.now();

    try {
      const result = await fetcher();
      logger.info("Canvas workspace sub-fetch completed", {
        workspaceId,
        fetchName,
        durationMs: Number((performance.now() - start).toFixed(2)),
        ...metadata,
      });
      return result;
    } catch (error) {
      logger.warn("Canvas workspace sub-fetch failed", {
        workspaceId,
        fetchName,
        durationMs: Number((performance.now() - start).toFixed(2)),
        error: error instanceof Error ? error.message : String(error),
        ...metadata,
      });
      throw error;
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
    userId?: string,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<any | null> {
    if (requestContext?.businessCasePromise) {
      return requestContext.businessCasePromise;
    }

    const businessCasePromise = (async () => {
      try {
        const supabase = requestContext?.supabase ?? getSupabaseClient();
        let query = supabase
          .from("business_cases")
          .select(
            `
          id,
          name,
          client,
          description,
          status,
          created_at,
          updated_at,
          metadata,
          owner_id
        `
          )
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
            .select(
              `
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
          `
            )
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
    })();

    if (requestContext) {
      requestContext.businessCasePromise = businessCasePromise;
    }

    return businessCasePromise;
  }

  private async fetchSystemMap(
    workspaceId: string,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<any | null> {
    if (requestContext?.systemMapPromise) {
      return requestContext.systemMapPromise;
    }

    const systemMapPromise = (async () => {
      try {
        const supabase = requestContext?.supabase ?? getSupabaseClient();
        const { data, error } = await supabase
          .from("system_maps")
          .select(SYSTEM_MAP_SELECT)
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
    })();

    if (requestContext) {
      requestContext.systemMapPromise = systemMapPromise;
    }

    return systemMapPromise;
  }

  private async fetchSystemMapId(
    workspaceId: string,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<string | null> {
    if (requestContext?.systemMapIdPromise) {
      return requestContext.systemMapIdPromise;
    }

    const systemMapIdPromise = (async () => {
      try {
        const systemMap = await this.fetchSystemMap(
          workspaceId,
          requestContext
        );
        if (systemMap?.id) {
          return systemMap.id as string;
        }

        const supabase = requestContext?.supabase ?? getSupabaseClient();
        const { data, error } = await supabase
          .from("system_maps")
          .select("id")
          .eq("business_case_id", workspaceId)
          .maybeSingle();

        if (error) {
          logger.warn("Error fetching system map id", {
            workspaceId,
            error: error.message,
          });
          return null;
        }

        return data?.id || null;
      } catch (error) {
        logger.error("Failed to fetch system map id", {
          workspaceId,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    })();

    if (requestContext) {
      requestContext.systemMapIdPromise = systemMapIdPromise;
    }

    return systemMapIdPromise;
  }

  private async fetchPersonas(
    workspaceId: string,
    businessCase?: PersonaBusinessCase | null,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<any[]> {
    try {
      const resolvedBusinessCase =
        businessCase ??
        (await this.fetchBusinessCase(workspaceId, undefined, requestContext));

      if (
        resolvedBusinessCase?.metadata?.stakeholders &&
        Array.isArray(resolvedBusinessCase.metadata.stakeholders)
      ) {
        return resolvedBusinessCase.metadata.stakeholders;
      }

      if (
        resolvedBusinessCase?.metadata?.personas &&
        Array.isArray(resolvedBusinessCase.metadata.personas)
      ) {
        return resolvedBusinessCase.metadata.personas;
      }

      return Object.entries(EXTENDED_STRUCTURAL_PERSONA_MAPS).map(
        ([key, p]) => ({
          id: key,
          name: this.formatPersonaName(key),
          role: key,
          primaryPain: p.primaryPain as string | undefined,
          painDescription: p.painDescription as string | undefined,
          keyKPIs: p.keyKPIs as string[] | undefined,
          financialDriver: p.financialDriver as string | undefined,
          typicalGoals: p.typicalGoals as string[] | undefined,
          communicationPreference: p.communicationPreference as
            | string
            | undefined,
        })
      );
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
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private async fetchKPIs(
    workspaceId: string,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<any[]> {
    if (requestContext?.kpisPromise) {
      return requestContext.kpisPromise;
    }

    const kpisPromise = (async () => {
      try {
        const supabase = requestContext?.supabase ?? getSupabaseClient();
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
            return targets.map(t => ({
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

        return (hypotheses || []).map(h => ({
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
    })();

    if (requestContext) {
      requestContext.kpisPromise = kpisPromise;
    }

    return kpisPromise;
  }

  private async fetchInterventions(
    workspaceId: string,
    systemMapIdInput?: Promise<string | null> | string | null,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<any[]> {
    try {
      const systemMapId = await Promise.resolve(
        systemMapIdInput ?? this.fetchSystemMapId(workspaceId, requestContext)
      );

      if (!systemMapId) {
        logger.debug("No system map found for workspace", { workspaceId });
        return [];
      }

      const supabase = requestContext?.supabase ?? getSupabaseClient();
      const { data: interventions, error: intError } = await supabase
        .from("intervention_points")
        .select("*")
        .eq("system_map_id", systemMapId)
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
    workspaceId: string,
    systemMapIdInput?: Promise<string | null> | string | null,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<OutcomeHypothesis[]> {
    try {
      const systemMapId = await Promise.resolve(
        systemMapIdInput ?? this.fetchSystemMapId(workspaceId, requestContext)
      );

      if (!systemMapId) {
        return [];
      }

      const supabase = requestContext?.supabase ?? getSupabaseClient();
      const { data, error } = await supabase
        .from("outcome_hypotheses")
        .select("*")
        .eq("system_map_id", systemMapId)
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

  private async fetchValueTree(
    workspaceId: string,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<any | null> {
    try {
      const supabase = requestContext?.supabase ?? getSupabaseClient();
      const { data, error } = await this.timedSubFetch(
        workspaceId,
        "query.valueTree",
        () =>
          supabase
            .from("value_trees")
            .select(VALUE_TREE_SELECT)
            .eq("value_case_id", workspaceId)
            .maybeSingle()
      );

      if (error) {
        logger.error("Error fetching value tree", {
          workspaceId,
          error: error.message,
        });
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        value_case_id: data.value_case_id,
        name: data.name,
        description: data.description,
        version: data.version,
        is_published: data.is_published,
        created_at: data.created_at,
        updated_at: data.updated_at,
        compliance_metadata: data.compliance_metadata,
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

  private async fetchGaps(
    workspaceId: string,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<any[]> {
    try {
      const supabase = requestContext?.supabase ?? getSupabaseClient();
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

      return (opportunities || []).map(opp => ({
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

  private async fetchROI(
    workspaceId: string,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<{
    model: ROIModel;
    calculations: ROIModelCalculation[];
    results: Record<string, FormulaResult>;
  } | null> {
    try {
      const supabase = requestContext?.supabase ?? getSupabaseClient();
      const { data: roiModel, error: rmError } = await this.timedSubFetch(
        workspaceId,
        "query.roi.model",
        () =>
          supabase
            .from("roi_models")
            .select(ROI_MODEL_SELECT)
            .eq("value_trees.value_case_id", workspaceId)
            .maybeSingle()
      );

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
      const context = await this.timedSubFetch(
        workspaceId,
        "query.roi.context",
        () => interpreter.createContextFromKPIs(workspaceId)
      );
      const results = await this.timedSubFetch(
        workspaceId,
        "query.roi.execute",
        () => interpreter.executeCalculationSequence(calculations, context)
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
    workspaceId: string,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<ManifestoValidationResult[]> {
    try {
      const supabase = requestContext?.supabase ?? getSupabaseClient();
      const results: ManifestoValidationResult[] = [];

      const collectResults = (
        artifacts: ManifestoArtifactRow[] | undefined
      ) => {
        if (!artifacts) {
          return;
        }

        artifacts.forEach(artifact => {
          if (artifact.compliance_metadata?.results) {
            results.push(...artifact.compliance_metadata.results);
          }
        });
      };

      const [
        valueTreesResponse,
        valueCommitsResponse,
        realizationReportsResponse,
        expansionModelsResponse,
      ] = await Promise.all([
        this.timedSubFetch(workspaceId, "query.manifesto.valueTrees", () =>
          supabase
            .from("value_trees")
            .select(
              `id, compliance_metadata, roi_models(id, compliance_metadata)`
            )
            .eq("value_case_id", workspaceId)
        ),
        this.timedSubFetch(workspaceId, "query.manifesto.valueCommits", () =>
          supabase
            .from("value_commits")
            .select("id, compliance_metadata")
            .eq("value_case_id", workspaceId)
        ),
        this.timedSubFetch(
          workspaceId,
          "query.manifesto.realizationReports",
          () =>
            supabase
              .from("realization_reports")
              .select("id, compliance_metadata")
              .eq("value_case_id", workspaceId)
        ),
        this.timedSubFetch(workspaceId, "query.manifesto.expansionModels", () =>
          supabase
            .from("expansion_models")
            .select("id, compliance_metadata")
            .eq("value_case_id", workspaceId)
        ),
      ]);

      const valueTrees = (valueTreesResponse.data ||
        []) as ValueTreeManifestoRow[];
      collectResults(valueTrees);
      valueTrees.forEach(valueTree => collectResults(valueTree.roi_models));
      collectResults(
        (valueCommitsResponse.data || []) as ManifestoArtifactRow[]
      );
      collectResults(
        (realizationReportsResponse.data || []) as ManifestoArtifactRow[]
      );
      collectResults(
        (expansionModelsResponse.data || []) as ManifestoArtifactRow[]
      );

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
    businessCase?: PersonaBusinessCase,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<VMRTAssumption[]> {
    try {
      const supabase = requestContext?.supabase ?? getSupabaseClient();
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
        const industryTraces = ALL_VMRT_SEEDS.filter(t => {
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
        trace =>
          trace.reasoningSteps?.flatMap(step => {
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

  private async fetchFeedbackLoops(
    workspaceId: string,
    systemMapIdInput?: Promise<string | null> | string | null,
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<any[]> {
    try {
      const systemMapId = await Promise.resolve(
        systemMapIdInput ?? this.fetchSystemMapId(workspaceId, requestContext)
      );

      if (!systemMapId) {
        return [];
      }

      const supabase = requestContext?.supabase ?? getSupabaseClient();
      const { data: loops, error: loopError } = await this.timedSubFetch(
        workspaceId,
        "query.feedbackLoops",
        () =>
          supabase
            .from("feedback_loops")
            .select(FEEDBACK_LOOP_SELECT)
            .eq("system_map_id", systemMapId)
      );

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

  private async fetchRealizationMetrics(
    workspaceId: string,
    feedbackLoopsInput?: Promise<FeedbackLoopRow[]> | FeedbackLoopRow[],
    requestContext?: CanvasWorkspaceRequestContext
  ): Promise<{
    implementationStatus: string;
    observedChanges: unknown[];
    kpiMeasurements: Record<string, unknown>[];
  } | null> {
    try {
      const supabase = requestContext?.supabase ?? getSupabaseClient();
      const [reportResponse, feedbackLoops] = await Promise.all([
        this.timedSubFetch(workspaceId, "query.realization.latestReport", () =>
          supabase
            .from("realization_reports")
            .select(REALIZATION_REPORT_SELECT)
            .eq("value_case_id", workspaceId)
            .order("report_period_end", { ascending: false })
            .limit(1)
            .maybeSingle()
        ),
        Promise.resolve(
          feedbackLoopsInput ??
            this.fetchFeedbackLoops(workspaceId, undefined, requestContext)
        ),
      ]);

      const report = reportResponse.data;
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

        const { data: results } = await this.timedSubFetch(
          workspaceId,
          "query.realization.results",
          () =>
            supabase
              .from("realization_results")
              .select(REALIZATION_RESULT_SELECT)
              .eq("realization_report_id", report.id)
        );

        if (results) {
          kpiMeasurements = results;
        }
      }

      const observedChanges = feedbackLoops.flatMap(
        loop => loop.behavior_changes || []
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
