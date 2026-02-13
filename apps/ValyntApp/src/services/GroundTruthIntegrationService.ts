/**
 * Ground Truth Integration Service
 *
 * Provides a unified interface for agents to access:
 * - ESO benchmarks and KPI data
 * - VOS-PT-1 reasoning traces
 * - Claim validation
 * - Value chain traversal
 */

import { ESOModule } from "../mcp-ground-truth/modules/ESOModule";
import { ALL_ESO_KPIS, EXTENDED_PERSONA_MAPS } from "../types/eso-data";
import { ALL_VMRT_SEEDS } from "../types/vos-pt1-seed";
import { checkBenchmarkAlignment } from "../types/eso";
import type { ESOKPINode, ESOPersona, FinancialDriver } from "../types/eso";
import type { VMRT } from "../types/vmrt";
import { logger } from "../lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface GroundTruthContext {
  organizationId: string;
  sessionId: string;
  persona?: ESOPersona;
  industry?: string;
}

export interface BenchmarkResult {
  metricId: string;
  name: string;
  value: number;
  unit: string;
  percentile: string;
  confidence: number;
  source: string;
}

export interface ValidationResult {
  valid: boolean;
  percentile: string;
  warning?: string;
  citation: string;
}

export interface ReasoningReference {
  traceId: string;
  summary: string;
  impact: number;
  relevanceScore: number;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class GroundTruthIntegrationService {
  private static instance: GroundTruthIntegrationService;
  private esoModule: ESOModule;
  private initialized = false;

  private kpiIndex: Map<string, ESOKPINode>;
  private vmrtIndex: Map<string, Partial<VMRT>>;

  private constructor() {
    this.esoModule = new ESOModule();
    this.kpiIndex = new Map();
    this.vmrtIndex = new Map();
  }

  static getInstance(): GroundTruthIntegrationService {
    if (!GroundTruthIntegrationService.instance) {
      GroundTruthIntegrationService.instance =
        new GroundTruthIntegrationService();
    }
    return GroundTruthIntegrationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.esoModule.initialize();

    // Build indices
    for (const kpi of ALL_ESO_KPIS) {
      this.kpiIndex.set(kpi.id, kpi);
    }
    for (const vmrt of ALL_VMRT_SEEDS) {
      if (vmrt.traceId) {
        this.vmrtIndex.set(vmrt.traceId, vmrt);
      }
    }

    this.initialized = true;
    logger.info(
      `GroundTruthIntegrationService initialized: ${this.kpiIndex.size} KPIs, ${this.vmrtIndex.size} traces`
    );
  }

  // ============================================================================
  // Agent Integration Methods
  // ============================================================================

  /**
   * Get benchmark for a specific KPI
   */
  async getBenchmark(
    metricId: string,
    percentile: "p25" | "p50" | "p75" = "p50"
  ): Promise<BenchmarkResult> {
    const kpi = this.kpiIndex.get(metricId);
    if (!kpi) {
      throw new Error(`Unknown metric: ${metricId}`);
    }

    return {
      metricId: kpi.id,
      name: kpi.name,
      value: kpi.benchmarks[percentile],
      unit: kpi.unit,
      percentile,
      confidence: 0.9,
      source: kpi.benchmarks.source,
    };
  }

  /**
   * Validate a financial claim against benchmarks
   */
  async validateClaim(
    metricId: string,
    claimedValue: number
  ): Promise<ValidationResult> {
    const result = checkBenchmarkAlignment(metricId, claimedValue);
    const kpi = this.kpiIndex.get(metricId);

    return {
      valid: result.aligned,
      percentile: result.percentile,
      warning: result.warning,
      citation: kpi
        ? `${kpi.benchmarks.source} (${kpi.benchmarks.vintage})`
        : "Unknown source",
    };
  }

  /**
   * Get KPIs relevant to a persona
   */
  async getPersonaKPIs(persona: ESOPersona): Promise<{
    kpis: BenchmarkResult[];
    financialDriver: FinancialDriver;
  }> {
    const personaMap = EXTENDED_PERSONA_MAPS.find((p) => p.persona === persona);
    if (!personaMap) {
      return { kpis: [], financialDriver: "cost_reduction" };
    }

    const kpis: BenchmarkResult[] = [];
    for (const kpiId of personaMap.keyKPIs) {
      try {
        const benchmark = await this.getBenchmark(kpiId);
        kpis.push(benchmark);
      } catch {
        // Skip unknown KPIs
      }
    }

    return {
      kpis,
      financialDriver: personaMap.financialDriver,
    };
  }

  /**
   * Find similar reasoning traces
   */
  async getSimilarTraces(
    filters: {
      industry?: string;
      outcomeCategory?: string;
      persona?: string;
    },
    limit = 5
  ): Promise<ReasoningReference[]> {
    const filtered = ALL_VMRT_SEEDS.filter((trace) => {
      if (
        filters.industry &&
        trace.context?.organization?.industry !== filters.industry
      ) {
        return false;
      }
      if (
        filters.outcomeCategory &&
        trace.valueModel?.outcomeCategory !== filters.outcomeCategory
      ) {
        return false;
      }
      if (filters.persona && trace.context?.persona !== filters.persona) {
        return false;
      }
      return true;
    });

    return filtered.slice(0, limit).map((trace, index) => ({
      traceId: trace.traceId || `unknown-${index}`,
      summary: trace.reasoningSteps?.[0]?.description || "No description",
      impact: trace.valueModel?.financialImpact?.totalImpact?.amount || 0,
      relevanceScore: trace.qualityMetrics?.overallConfidence || 0.5,
    }));
  }

  /**
   * Enrich agent output with ground truth citations
   */
  async enrichWithCitations(
    metricIds: string[],
    claims: { metricId: string; value: number }[]
  ): Promise<{
    benchmarks: Record<string, BenchmarkResult>;
    validations: Record<string, ValidationResult>;
    overallConfidence: number;
  }> {
    const benchmarks: Record<string, BenchmarkResult> = {};
    const validations: Record<string, ValidationResult> = {};

    for (const metricId of metricIds) {
      try {
        benchmarks[metricId] = await this.getBenchmark(metricId);
      } catch {
        // Skip unknown metrics
      }
    }

    for (const claim of claims) {
      try {
        validations[claim.metricId] = await this.validateClaim(
          claim.metricId,
          claim.value
        );
      } catch {
        // Skip failed validations
      }
    }

    const validCount = Object.values(validations).filter((v) => v.valid).length;
    const totalCount = Object.values(validations).length;
    const overallConfidence = totalCount > 0 ? validCount / totalCount : 0;

    return {
      benchmarks,
      validations,
      overallConfidence,
    };
  }

  /**
   * Get coverage statistics
   */
  getStats(): {
    kpiCount: number;
    vmrtCount: number;
    industries: string[];
    personas: string[];
  } {
    const industries = new Set<string>();
    const personas = new Set<string>();

    for (const kpi of this.kpiIndex.values()) {
      industries.add(kpi.domain);
    }
    for (const persona of EXTENDED_PERSONA_MAPS) {
      personas.add(persona.persona);
    }

    return {
      kpiCount: this.kpiIndex.size,
      vmrtCount: this.vmrtIndex.size,
      industries: Array.from(industries),
      personas: Array.from(personas),
    };
  }
}

// Export singleton getter
export function getGroundTruthService(): GroundTruthIntegrationService {
  return GroundTruthIntegrationService.getInstance();
}
