/**
 * ESOModule - Economic Structure Ontology & VOS-PT-1 MCP Module
 *
 * Provides tools for:
 * - get_metric_value: Retrieve KPI benchmarks with industry/size context
 * - validate_claim: Check financial claims against ground truth
 * - get_value_chain: Trace causal relationships between KPIs
 * - get_similar_traces: Find relevant VMRT examples for reasoning
 */

import { checkBenchmarkAlignment } from "../../types/eso";
import type {
  ESOEdge,
  ESOIndustry,
  ESOKPINode,
  ESOPersonaValueMap,
} from "../../types/eso";
import {
  ALL_ESO_KPIS,
  EXTENDED_ESO_EDGES,
  EXTENDED_PERSONA_MAPS,
} from "../../types/eso-data";
import { ALL_VMRT_SEEDS } from "../../types/vos-pt1-seed";
import { BaseModule } from "../core/BaseModule";
import type { ModuleRequest, ModuleResponse } from '../types';

import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

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
  warning?: string;
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

// ============================================================================
// Module Implementation
// ============================================================================

export class ESOModule extends BaseModule {
  name = 'eso';
  tier = 'tier3' as const;
  description = 'Economic Structure Ontology — KPI benchmarks, causal value chains, and VMRT reasoning traces';

  readonly moduleVersion = "1.0.0";

  private kpiIndex: Map<string, ESOKPINode>;
  private edgeIndex: Map<string, ESOEdge[]>;
  private personaIndex: Map<string, ESOPersonaValueMap>;

  constructor() {
    super();
    this.kpiIndex = new Map();
    this.edgeIndex = new Map();
    this.personaIndex = new Map();
  }

  canHandle(request: ModuleRequest): boolean {
    // Handles any request with a metric ID that exists in the KPI index,
    // or any request routed to the ESO tool namespace
    return !!(
      request.metric &&
      (this.kpiIndex.has(request.metric) || request.identifier === 'eso')
    );
  }

  async query(request: ModuleRequest): Promise<ModuleResponse> {
    return this.executeWithMetrics(request, async () => {
      const metricId = request.metric ?? request.identifier;
      const kpi = this.kpiIndex.get(metricId);
      if (!kpi) {
        throw new Error(`Unknown metric: ${metricId}`);
      }
      return this.createMetric(
        metricId,
        kpi.benchmarks.p50,
        {
          source_type: 'benchmark',
          extraction_method: 'api',
        },
        {
          unit: kpi.unit,
          domain: kpi.domain,
          benchmarks: kpi.benchmarks,
          improvementDirection: kpi.improvementDirection,
        },
      );
    });
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
      confidence: 0.9,
    };
  }

  private validateClaim(request: ValidateClaimRequest): ValidateClaimResponse {
    const result = checkBenchmarkAlignment(
      request.metricId,
      request.claimedValue
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
      valid: result.aligned,
      percentile: result.percentile,
      warning: result.warning,
      benchmark: {
        p25: kpi.benchmarks.p25,
        p50: kpi.benchmarks.p50,
        p75: kpi.benchmarks.p75,
      },
      recommendation: result.warning
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
      if (
        request.industry &&
        trace.context?.organization?.industry !== request.industry
      ) {
        return false;
      }
      if (
        request.outcomeCategory &&
        trace.valueModel?.outcomeCategory !== request.outcomeCategory
      ) {
        return false;
      }
      if (request.persona && trace.context?.persona !== request.persona) {
        return false;
      }
      return true;
    });

    const traces = filtered.slice(0, limit).map((trace) => ({
      traceId: trace.traceId,
      summary: trace.reasoningSteps?.[0]?.description || "No summary",
      industry: trace.context?.organization?.industry || "unknown",
      outcomeCategory: trace.valueModel?.outcomeCategory || "unknown",
      totalImpact: trace.valueModel?.financialImpact?.totalImpact?.amount || 0,
      confidence: trace.qualityMetrics?.overallConfidence || 0,
    }));

    return {
      traces,
      count: traces.length,
    };
  }

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
