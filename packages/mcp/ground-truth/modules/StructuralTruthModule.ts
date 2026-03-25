/**
 * ESOModule - Economic Structure Ontology & VOS-PT-1 MCP Module
 *
 * Provides tools for:
 * - get_metric_value: Retrieve KPI benchmarks with industry/size context
 * - validate_claim: Check financial claims against ground truth
 * - get_value_chain: Trace causal relationships between KPIs
 * - get_similar_traces: Find relevant VMRT examples for reasoning
 */

import {
  assessImprovementFeasibility,
  checkBenchmarkAlignment,
  classifyClaimSeverity,
  computeCompositeHealth,
  computeConfidenceScore,
} from "@backend/types/eso";
import type {
  CompanySize,
  ESOEdge,
  ESOIndustry,
  ESOKPINode,
  ESOPersonaValueMap,
  ImpactNode,
} from "@backend/types/eso";
import {
  adjustBenchmarkForSize,
  ALL_ESO_KPIS,
  EXTENDED_ESO_EDGES,
  EXTENDED_PERSONA_MAPS,
} from "@backend/types/eso-data";
import { ALL_VMRT_SEEDS } from "@backend/types/vos-pt1-seed";
import { z } from "zod";

import { logger } from "../../lib/logger";
import { BaseModule } from "../core/BaseModule";
import { ErrorCodes, GroundTruthError } from "../types";
import type { ModuleRequest, ModuleResponse } from "../types";

// ============================================================================
// Types
// ============================================================================

export const STRUCTURAL_TRUTH_SCHEMA_FIELDS = [
  "integrity_checks",
  "analysis",
  "timestamp",
] as const;

export const StructuralTruthModuleSchema = z
  .object({
    integrity_checks: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        confidence: z.number().min(0).max(1),
        category: z.string(),
        priority: z.string(),
        status: z.string(),
      })
    ),
    analysis: z.string(),
    timestamp: z.string(),
  })
  .passthrough();

interface MetricValueRequest {
  metricId: string;
  industry?: ESOIndustry;
  companySize?: "smb" | "mid_market" | "enterprise";
  percentile?: "p25" | "p50" | "p75";
}

interface MetricValueResponse {
  metricId: string;
  name: string;
  value: number;
  unit: string;
  percentile: string;
  source: string;
  benchmarks: {
    p25: number;
    p50: number;
    p75: number;
    worldClass?: number;
  };
  context: {
    industry: string;
    improvementDirection: string;
  };
  confidence: number;
}

interface ValidateClaimRequest {
  metricId: string;
  claimedValue: number;
  projectedImprovement?: number;
}

interface ValidateClaimResponse {
  valid: boolean;
  percentile: string;
  severity?: string;
  warning?: string;
  detail?: string;
  benchmark: {
    p25: number;
    p50: number;
    p75: number;
  };
  recommendation?: string;
}

interface ValueChainRequest {
  metricId: string;
  depth?: number;
}

interface ValueChainResponse {
  rootMetric: ESOKPINode;
  upstream: Array<{
    metric: ESOKPINode;
    relationship: ESOEdge;
  }>;
  downstream: Array<{
    metric: ESOKPINode;
    relationship: ESOEdge;
  }>;
  financialDrivers: string[];
}

interface SimilarTracesRequest {
  industry?: string;
  outcomeCategory?: string;
  persona?: string;
  limit?: number;
}

interface SimilarTracesResponse {
  traces: Array<{
    traceId: string;
    summary: string;
    industry: string;
    outcomeCategory: string;
    totalImpact: number;
    confidence: number;
  }>;
  count: number;
}

interface ImpactSimulationRequest {
  metricId: string;
  deltaPercent: number;
  depth?: number;
  companySize?: CompanySize;
}

interface ImpactSimulationResponse {
  rootMetricId: string;
  rootDeltaPercent: number;
  impactedMetrics: ImpactNode[];
  totalCascadeCount: number;
  maxDepthReached: number;
  confidenceDecayRate: number;
}

interface FeasibilityRequest {
  metricId: string;
  currentValue: number;
  targetValue: number;
}

interface CompositeHealthRequest {
  metrics: Array<{ metricId: string; value: number }>;
}

interface SeverityRequest {
  metricId: string;
  claimedValue: number;
}

// ============================================================================
// Module Implementation
// ============================================================================

export class ESOModule extends BaseModule {
  readonly moduleName = "eso";
  readonly moduleVersion = "1.0.0";

  name = "eso";
  tier = "tier2" as const;
  description = "ESO structural truth module - industry KPI benchmarks and causal relationships";

  query(_request: ModuleRequest): Promise<ModuleResponse> {
    throw new GroundTruthError(
      ErrorCodes.INVALID_REQUEST,
      "ESOModule does not support generic queries — use executeTool() instead"
    );
  }

  canHandle(_request: ModuleRequest): boolean {
    return false;
  }

  private kpiIndex: Map<string, ESOKPINode>;
  private edgeIndex: Map<string, ESOEdge[]>;
  private personaIndex: Map<string, ESOPersonaValueMap>;

  constructor() {
    super();
    this.kpiIndex = new Map();
    this.edgeIndex = new Map();
    this.personaIndex = new Map();
  }

  override async initialize(): Promise<void> {
    // Index all KPIs
    for (const kpi of ALL_ESO_KPIS) {
      this.kpiIndex.set(kpi.id, kpi);
    }

    // Index edges by source
    for (const edge of EXTENDED_ESO_EDGES) {
      const existing = this.edgeIndex.get(edge.sourceId) || [];
      existing.push(edge);
      this.edgeIndex.set(edge.sourceId, existing);
    }

    // Index personas
    for (const persona of EXTENDED_PERSONA_MAPS) {
      this.personaIndex.set(persona.persona, persona);
    }

    logger.info("ESO Module initialized", {
      kpis: this.kpiIndex.size,
      edges: EXTENDED_ESO_EDGES.length,
    });
  }

  getTools() {
    return [
      {
        name: "eso_get_metric_value",
        description: "Get benchmark value for a KPI with industry context",
        inputSchema: {
          type: "object",
          properties: {
            metricId: {
              type: "string",
              description: "KPI identifier (e.g., saas_nrr, fin_dso)",
            },
            industry: { type: "string", description: "Industry vertical" },
            companySize: {
              type: "string",
              enum: ["smb", "mid_market", "enterprise"],
            },
            percentile: {
              type: "string",
              enum: ["p25", "p50", "p75"],
              default: "p50",
            },
          },
          required: ["metricId"],
        },
      },
      {
        name: "eso_validate_claim",
        description: "Validate a financial claim against industry benchmarks",
        inputSchema: {
          type: "object",
          properties: {
            metricId: { type: "string", description: "KPI identifier" },
            claimedValue: {
              type: "number",
              description: "The claimed metric value",
            },
            projectedImprovement: {
              type: "number",
              description: "Optional projected improvement",
            },
          },
          required: ["metricId", "claimedValue"],
        },
      },
      {
        name: "eso_get_value_chain",
        description: "Get causal relationships and financial drivers for a KPI",
        inputSchema: {
          type: "object",
          properties: {
            metricId: { type: "string", description: "KPI identifier" },
            depth: {
              type: "number",
              description: "Traversal depth",
              default: 2,
            },
          },
          required: ["metricId"],
        },
      },
      {
        name: "eso_get_similar_traces",
        description: "Find similar VMRT reasoning traces for reference",
        inputSchema: {
          type: "object",
          properties: {
            industry: { type: "string", description: "Filter by industry" },
            outcomeCategory: {
              type: "string",
              description: "Filter by outcome type",
            },
            persona: {
              type: "string",
              description: "Filter by target persona",
            },
            limit: { type: "number", default: 5 },
          },
        },
      },
      {
        name: "eso_get_persona_kpis",
        description: "Get KPIs relevant to a stakeholder persona",
        inputSchema: {
          type: "object",
          properties: {
            persona: {
              type: "string",
              description: "Persona (cfo, cio, vp_ops, etc.)",
            },
          },
          required: ["persona"],
        },
      },
      {
        name: "eso_simulate_impact",
        description:
          "Simulate cascading impact of improving a KPI by a given percentage through the causal graph",
        inputSchema: {
          type: "object",
          properties: {
            metricId: { type: "string", description: "Root KPI to change" },
            deltaPercent: {
              type: "number",
              description: "Percentage change (e.g. 10 for +10%)",
            },
            depth: { type: "number", default: 3, description: "Max hops" },
            companySize: {
              type: "string",
              enum: ["smb", "mid_market", "enterprise"],
              description: "Optional company size for adjusted benchmarks",
            },
          },
          required: ["metricId", "deltaPercent"],
        },
      },
      {
        name: "eso_assess_feasibility",
        description:
          "Assess how feasible it is to improve a KPI from a current value to a target value",
        inputSchema: {
          type: "object",
          properties: {
            metricId: { type: "string" },
            currentValue: { type: "number" },
            targetValue: { type: "number" },
          },
          required: ["metricId", "currentValue", "targetValue"],
        },
      },
      {
        name: "eso_composite_health",
        description:
          "Score an organization's health across multiple KPIs with graph-weighted grading",
        inputSchema: {
          type: "object",
          properties: {
            metrics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  metricId: { type: "string" },
                  value: { type: "number" },
                },
                required: ["metricId", "value"],
              },
              description: "Array of { metricId, value } pairs",
            },
          },
          required: ["metrics"],
        },
      },
      {
        name: "eso_classify_severity",
        description:
          "Classify a claimed value into plausible/optimistic/aspirational/implausible severity bands",
        inputSchema: {
          type: "object",
          properties: {
            metricId: { type: "string" },
            claimedValue: { type: "number" },
          },
          required: ["metricId", "claimedValue"],
        },
      },
    ];
  }

  async handleToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    switch (toolName) {
      case "eso_get_metric_value":
        return this.getMetricValue(args as unknown as MetricValueRequest);
      case "eso_validate_claim":
        return this.validateClaim(args as unknown as ValidateClaimRequest);
      case "eso_get_value_chain":
        return this.getValueChain(args as unknown as ValueChainRequest);
      case "eso_get_similar_traces":
        return this.getSimilarTraces(args as unknown as SimilarTracesRequest);
      case "eso_get_persona_kpis":
        return this.getPersonaKPIs(args.persona as string);
      case "eso_simulate_impact":
        return this.simulateImpact(args as unknown as ImpactSimulationRequest);
      case "eso_assess_feasibility":
        return assessImprovementFeasibility(
          (args as unknown as FeasibilityRequest).metricId,
          (args as unknown as FeasibilityRequest).currentValue,
          (args as unknown as FeasibilityRequest).targetValue,
        );
      case "eso_composite_health":
        return computeCompositeHealth(
          (args as unknown as CompositeHealthRequest).metrics,
        );
      case "eso_classify_severity": {
        const req = args as unknown as SeverityRequest;
        return classifyClaimSeverity(req.metricId, req.claimedValue);
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // ============================================================================
  // Tool Implementations
  // ============================================================================

  private getMetricValue(request: MetricValueRequest): MetricValueResponse {
    const kpi = this.kpiIndex.get(request.metricId);
    if (!kpi) {
      throw new Error(`Unknown metric: ${request.metricId}`);
    }

    const percentile = request.percentile || "p50";
    const value = kpi.benchmarks[
      percentile as keyof typeof kpi.benchmarks
    ] as number;

    const confidenceResult = computeConfidenceScore(kpi);

    return {
      metricId: kpi.id,
      name: kpi.name,
      value,
      unit: kpi.unit,
      percentile,
      source: kpi.benchmarks.source,
      benchmarks: {
        p25: kpi.benchmarks.p25,
        p50: kpi.benchmarks.p50,
        p75: kpi.benchmarks.p75,
        worldClass: kpi.benchmarks.worldClass,
      },
      context: {
        industry: kpi.domain,
        improvementDirection: kpi.improvementDirection,
      },
      confidence: confidenceResult.value,
    };
  }

  private validateClaim(request: ValidateClaimRequest): ValidateClaimResponse {
    const alignment = checkBenchmarkAlignment(
      request.metricId,
      request.claimedValue
    );
    const severity = classifyClaimSeverity(
      request.metricId,
      request.claimedValue,
    );
    const kpi = this.kpiIndex.get(request.metricId);

    if (!kpi) {
      return {
        valid: false,
        percentile: "unknown",
        warning: `Unknown metric: ${request.metricId}`,
        benchmark: { p25: 0, p50: 0, p75: 0 },
      };
    }

    return {
      valid: alignment.aligned,
      percentile: alignment.percentile,
      severity: severity.severity,
      warning: alignment.warning,
      detail: severity.detail,
      benchmark: {
        p25: kpi.benchmarks.p25,
        p50: kpi.benchmarks.p50,
        p75: kpi.benchmarks.p75,
      },
      recommendation: alignment.warning
        ? "Consider using P50 benchmark for conservative estimates"
        : undefined,
    };
  }

  private getValueChain(request: ValueChainRequest): ValueChainResponse {
    const kpi = this.kpiIndex.get(request.metricId);
    if (!kpi) {
      throw new Error(`Unknown metric: ${request.metricId}`);
    }

    const upstream: ValueChainResponse["upstream"] = [];
    const downstream: ValueChainResponse["downstream"] = [];

    // Find upstream (dependencies)
    for (const depId of kpi.dependencies) {
      const depKpi = this.kpiIndex.get(depId);
      if (depKpi) {
        const edge = EXTENDED_ESO_EDGES.find(
          (e) => e.sourceId === depId && e.targetId === kpi.id
        );
        if (edge) {
          upstream.push({ metric: depKpi, relationship: edge });
        }
      }
    }

    // Find downstream (what depends on this)
    const edges = this.edgeIndex.get(request.metricId) || [];
    for (const edge of edges) {
      const targetKpi = this.kpiIndex.get(edge.targetId);
      if (targetKpi) {
        downstream.push({ metric: targetKpi, relationship: edge });
      }
    }

    // Find financial drivers from persona maps
    const financialDrivers: string[] = [];
    for (const persona of EXTENDED_PERSONA_MAPS) {
      if (persona.keyKPIs.includes(request.metricId)) {
        financialDrivers.push(persona.financialDriver);
      }
    }

    return {
      rootMetric: kpi,
      upstream,
      downstream,
      financialDrivers: [...new Set(financialDrivers)],
    };
  }

  private getSimilarTraces(
    request: SimilarTracesRequest
  ): SimilarTracesResponse {
    const limit = request.limit || 5;

    const filtered = ALL_VMRT_SEEDS.filter((trace) => {
      const t = trace as unknown as Record<string, Record<string, unknown>>;
      const ctx = t["context"] ?? {};
      const vm = t["valueModel"] ?? {};
      const org = ctx["organization"] as Record<string, unknown> | undefined;
      if (request.industry && org?.["industry"] !== request.industry) {
        return false;
      }
      if (request.outcomeCategory && vm["outcomeCategory"] !== request.outcomeCategory) {
        return false;
      }
      if (request.persona && ctx["persona"] !== request.persona) {
        return false;
      }
      return true;
    });

    const traces = filtered.slice(0, limit).map((trace) => {
      const t = trace as unknown as Record<string, unknown>;
      const ctx = (t["context"] ?? {}) as Record<string, unknown>;
      const vm = (t["valueModel"] ?? {}) as Record<string, unknown>;
      const qm = (t["qualityMetrics"] ?? {}) as Record<string, unknown>;
      const steps = t["reasoningSteps"] as Record<string, unknown>[] | undefined;
      const step0 = steps?.[0] ?? {};
      const org = ctx["organization"] as Record<string, unknown> | undefined;
      const fi = vm["financialImpact"] as Record<string, unknown> | undefined;
      const ti = fi?.["totalImpact"] as Record<string, unknown> | undefined;
      return {
        traceId: trace.traceId!,
        summary: (step0["description"] as string | undefined) || "No summary",
        industry: (org?.["industry"] as string | undefined) || "unknown",
        outcomeCategory: (vm["outcomeCategory"] as string | undefined) || "unknown",
        totalImpact: (ti?.["amount"] as number | undefined) || 0,
        confidence: (qm["overallConfidence"] as number | undefined) || 0,
      };
    });

    return {
      traces,
      count: traces.length,
    };
  }

  // ============================================================================
  // Impact Simulation — cascading what-if through the causal DAG
  // ============================================================================

  private simulateImpact(
    request: ImpactSimulationRequest,
  ): ImpactSimulationResponse {
    const rootKpi = this.kpiIndex.get(request.metricId);
    if (!rootKpi) {
      throw new Error(`Unknown metric: ${request.metricId}`);
    }

    const maxDepth = Math.min(request.depth ?? 3, 5);
    const decayRate = 0.7; // confidence decays 30% per hop
    const visited = new Set<string>([request.metricId]);
    const impacted: ImpactNode[] = [];

    // BFS through outgoing edges
    interface QueueItem {
      metricId: string;
      parentDelta: number;
      depth: number;
      confidence: number;
    }

    const queue: QueueItem[] = [];
    const rootEdges = this.edgeIndex.get(request.metricId) ?? [];
    for (const edge of rootEdges) {
      if (!visited.has(edge.targetId)) {
        queue.push({
          metricId: edge.targetId,
          parentDelta: request.deltaPercent,
          depth: 1,
          confidence: decayRate,
        });
        visited.add(edge.targetId);
      }
    }

    let maxDepthReached = 0;

    while (queue.length > 0) {
      const item = queue.shift()!;
      if (item.depth > maxDepth) continue;
      maxDepthReached = Math.max(maxDepthReached, item.depth);

      const kpi = this.kpiIndex.get(item.metricId);
      if (!kpi) continue;

      // Find the edge from parent to this node
      const incomingEdge = EXTENDED_ESO_EDGES.find(
        (e) => e.targetId === item.metricId && visited.has(e.sourceId),
      ) ?? EXTENDED_ESO_EDGES.find((e) => e.targetId === item.metricId);

      const weight = incomingEdge?.weight ?? 0.5;
      const relationship = incomingEdge?.relationship ?? "correlates";
      const sign = relationship === "inhibits" ? -1 : 1;
      const cascadedDelta = item.parentDelta * weight * sign;

      const baseValue = request.companySize
        ? adjustBenchmarkForSize(item.metricId, kpi.benchmarks.p50, request.companySize)
        : kpi.benchmarks.p50;
      const projectedValue = baseValue * (1 + cascadedDelta / 100);

      impacted.push({
        metricId: item.metricId,
        name: kpi.name,
        baselineValue: baseValue,
        projectedValue,
        deltaPercent: cascadedDelta,
        confidence: item.confidence,
        pathLength: item.depth,
        relationship,
      });

      // Continue BFS
      const childEdges = this.edgeIndex.get(item.metricId) ?? [];
      for (const edge of childEdges) {
        if (!visited.has(edge.targetId) && item.depth + 1 <= maxDepth) {
          queue.push({
            metricId: edge.targetId,
            parentDelta: cascadedDelta,
            depth: item.depth + 1,
            confidence: item.confidence * decayRate,
          });
          visited.add(edge.targetId);
        }
      }
    }

    return {
      rootMetricId: request.metricId,
      rootDeltaPercent: request.deltaPercent,
      impactedMetrics: impacted,
      totalCascadeCount: impacted.length,
      maxDepthReached,
      confidenceDecayRate: decayRate,
    };
  }

  // ============================================================================
  // Persona KPIs
  // ============================================================================

  private getPersonaKPIs(persona: string) {
    const personaMap = this.personaIndex.get(persona);
    if (!personaMap) {
      throw new Error(`Unknown persona: ${persona}`);
    }

    const kpis = personaMap.keyKPIs
      .map((id) => this.kpiIndex.get(id))
      .filter(Boolean) as ESOKPINode[];

    return {
      persona: personaMap.persona,
      primaryPain: personaMap.primaryPain,
      financialDriver: personaMap.financialDriver,
      kpis: kpis.map((kpi) => ({
        id: kpi.id,
        name: kpi.name,
        benchmarks: kpi.benchmarks,
        improvementDirection: kpi.improvementDirection,
      })),
      communicationPreference: personaMap.communicationPreference,
    };
  }
}
