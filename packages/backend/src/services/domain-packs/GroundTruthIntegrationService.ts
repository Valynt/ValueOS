/**
 * Ground Truth Integration Service
 *
 * Provides a unified interface for agents to access:
 * - ESO benchmarks and KPI data
 * - VOS-PT-1 reasoning traces
 * - Claim validation
 * - Value chain traversal
 */

import { ESOModule } from "@mcp/ground-truth/modules/StructuralTruthModule";

import { logger } from "../../lib/logger.js";
import {
  assessImprovementFeasibility,
  checkBenchmarkAlignment,
  classifyClaimSeverity,
  computeCompositeHealth,
  computeConfidenceScore,
} from "../../types/eso";
import type {
  ClaimSeverity,
  CompanySize,
  CompositeHealthResult,
  ConfidenceScore,
  ESOKPINode,
  ESOPersona,
  FeasibilityResult,
  FinancialDriver,
} from "../../types/eso";
import { adjustBenchmarkForSize, ALL_ESO_KPIS, EXTENDED_PERSONA_MAPS } from "../../types/eso-data";
import type { VMRT } from "../../types/vmrt";
import { ALL_VMRT_SEEDS } from "../../types/vos-pt1-seed";

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
  severity: ClaimSeverity;
  warning?: string;
  detail: string;
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
  private initializationPromise: Promise<void> | null = null;

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
    if (this.initialized) {
      return;
    }

    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        await this.esoModule.initialize();

        // Build indices
        this.kpiIndex.clear();
        this.vmrtIndex.clear();
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
      })();
    }

    try {
      await this.initializationPromise;
    } finally {
      if (this.initialized) {
        this.initializationPromise = null;
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
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
    await this.ensureInitialized();

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
    await this.ensureInitialized();

    const alignment = checkBenchmarkAlignment(metricId, claimedValue);
    const severity = classifyClaimSeverity(metricId, claimedValue);
    const kpi = this.kpiIndex.get(metricId);

    const vintage = kpi?.benchmarks.vintage;
    const citation = kpi
      ? vintage
        ? `${kpi.benchmarks.source} (${vintage})`
        : kpi.benchmarks.source
      : "Unknown source";

    return {
      valid: alignment.aligned,
      percentile: alignment.percentile,
      severity: severity.severity,
      warning: alignment.warning,
      detail: severity.detail,
      citation,
    };
  }

  /**
   * Get KPIs relevant to a persona
   */
  async getPersonaKPIs(persona: ESOPersona): Promise<{
    kpis: BenchmarkResult[];
    financialDriver: FinancialDriver;
  }> {
    await this.ensureInitialized();

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
    await this.ensureInitialized();

    const filtered = Array.from(this.vmrtIndex.values()).filter((trace) => {
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
    await this.ensureInitialized();

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
   * Assess feasibility of improving a KPI from current to target value.
   */
  async assessFeasibility(
    metricId: string,
    currentValue: number,
    targetValue: number,
  ): Promise<FeasibilityResult> {
    await this.ensureInitialized();
    return assessImprovementFeasibility(metricId, currentValue, targetValue);
  }

  /**
   * Score an organization's health across multiple KPIs.
   */
  async scoreCompositeHealth(
    metrics: Array<{ metricId: string; value: number }>,
  ): Promise<CompositeHealthResult> {
    await this.ensureInitialized();
    return computeCompositeHealth(metrics);
  }

  /**
   * Compute data-quality-aware confidence for a KPI benchmark.
   */
  async getConfidenceScore(metricId: string): Promise<ConfidenceScore | null> {
    await this.ensureInitialized();
    const kpi = this.kpiIndex.get(metricId);
    if (!kpi) return null;
    return computeConfidenceScore(kpi);
  }

  /**
   * Get a size-adjusted benchmark for a KPI.
   */
  async getSizeAdjustedBenchmark(
    metricId: string,
    size: CompanySize,
    percentile: "p25" | "p50" | "p75" = "p50",
  ): Promise<BenchmarkResult | null> {
    await this.ensureInitialized();
    const kpi = this.kpiIndex.get(metricId);
    if (!kpi) return null;

    const baseValue = kpi.benchmarks[percentile];
    const adjustedValue = adjustBenchmarkForSize(metricId, baseValue, size);
    const confidence = computeConfidenceScore(kpi, { sizeAdjusted: true });

    return {
      metricId: kpi.id,
      name: kpi.name,
      value: adjustedValue,
      unit: kpi.unit,
      percentile,
      confidence: confidence.value,
      source: kpi.benchmarks.source,
    };
  }

  /**
   * Verify if a source ID exists in the ground truth database
   */
  async verifySourceId(id: string): Promise<boolean> {
    await this.ensureInitialized();

    // Check KPIs
    if (this.kpiIndex.has(id)) return true;

    // Check VMRT traces
    if (this.vmrtIndex.has(id)) return true;

    // Check if it matches a known pattern even if not in memory index
    // e.g. VMRT-BENCH-xxx
    if (id.startsWith("VMRT-") || id.startsWith("ESO-KPI-")) {
      // In a real system, we might query the DB if not in memory cache
      return false;
    }

    return false;
  }

  /**
   * Get coverage statistics
   */
  async getStats(): Promise<{
    kpiCount: number;
    vmrtCount: number;
    industries: string[];
    personas: string[];
  }> {
    await this.ensureInitialized();

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
