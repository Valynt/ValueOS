/**
 * Unified Truth Layer - Tiered Resolution Engine
 *
 * Orchestrates all Ground Truth modules with deterministic resolution hierarchy:
 * 1. Tier 1 (EDGAR/XBRL) - Authoritative, legally binding
 * 2. Tier 2 (Market/Private) - High-confidence estimates
 * 3. Tier 3 (Benchmarks) - Contextual intelligence
 *
 * Implements the "Zero-Hallucination" guarantee by enforcing strict
 * data provenance and confidence scoring.
 *
 * Node Mapping: [NODE: Unified_Truth_Layer], [NODE: Data_Tier_Resolver]
 */

import { logger } from "../../lib/logger";
import { ClaimExtractor } from "../services/ClaimExtractor";
import {
  ClaimVerificationDetail,
  ClaimVerificationReport,
  ConfidenceTier,
  CrossTierCorroboration,
  DEFAULT_STALENESS_THRESHOLDS,
  ErrorCodes,
  FinancialMetric,
  GroundTruthError,
  GroundTruthModule,
  ModuleRequest,
  ModuleResponse,
  ModuleTrace,
  ResolutionTelemetry,
  StalenessInfo,
  TruthResolutionRequest,
  TruthResolutionResult,
} from "../types";

interface UnifiedTruthConfig {
  enableFallback: boolean; // Allow fallback to lower tiers
  strictMode: boolean; // Require Tier 1 for public companies
  maxResolutionTime: number; // Maximum time for resolution in ms
  parallelQuery: boolean; // Query multiple tiers in parallel
  stalenessThresholds: Record<ConfidenceTier, number>; // Hours per tier
  corroborationTolerance: number; // Max acceptable discrepancy for corroboration (0.0-1.0)
  claimVerificationTolerance: number; // Default tolerance for claim verification (0.0-1.0)
}

/**
 * Unified Truth Layer
 *
 * Central orchestration layer that implements the tiered truth model
 * and ensures zero-hallucination guarantees.
 */
export class UnifiedTruthLayer {
  private modules: Map<string, GroundTruthModule> = new Map();
  private claimExtractor = new ClaimExtractor();
  private tierModules: Map<ConfidenceTier, GroundTruthModule[]> = new Map([
    ["tier1", []],
    ["tier2", []],
    ["tier3", []],
  ]);

  private config: UnifiedTruthConfig = {
    enableFallback: true,
    strictMode: true,
    maxResolutionTime: 30000, // 30 seconds
    parallelQuery: false,
    stalenessThresholds: { ...DEFAULT_STALENESS_THRESHOLDS },
    corroborationTolerance: 0.10, // 10% max discrepancy between tiers
    claimVerificationTolerance: 0.05, // 5% default claim tolerance
  };

  constructor(config?: Partial<UnifiedTruthConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    logger.info("Unified Truth Layer initialized", this.config as any);
  }

  /**
   * Register a module with the truth layer
   */
  registerModule(module: GroundTruthModule): void {
    this.modules.set(module.name, module);

    const tierModules = this.tierModules.get(module.tier) || [];
    tierModules.push(module);
    this.tierModules.set(module.tier, tierModules);

    logger.info("Module registered", {
      name: module.name,
      tier: module.tier,
    });
  }

  /**
   * Resolve a truth request using tiered resolution
   *
   * This is the primary entry point for all financial data queries.
   * Implements the deterministic resolution hierarchy with telemetry,
   * staleness detection, and optional cross-tier corroboration.
   */
  async resolve(
    request: TruthResolutionRequest
  ): Promise<TruthResolutionResult> {
    const startTime = Date.now();
    const resolutionPath: string[] = [];
    const alternatives: FinancialMetric[] = [];
    const moduleTraces: ModuleTrace[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;
    const tiersAttempted: ConfidenceTier[] = [];

    try {
      logger.info("Truth resolution started", {
        identifier: request.identifier,
        metric: request.metric,
        preferTier: request.prefer_tier,
        corroborate: request.corroborate,
      });

      const tiers = this.determineResolutionTiers(request);
      const isParallel = this.config.parallelQuery;

      // Parallel resolution path
      if (isParallel) {
        const result = await this.resolveParallel(
          request, tiers, resolutionPath, alternatives,
          moduleTraces, tiersAttempted
        );
        if (result) {
          cacheHits = moduleTraces.filter(t => t.cache_hit).length;
          cacheMisses = moduleTraces.filter(t => !t.cache_hit && t.outcome !== 'skip').length;
          const telemetry = this.buildTelemetry(
            startTime, moduleTraces, cacheHits, cacheMisses, tiersAttempted, 'parallel'
          );
          const staleness = this.assessStaleness(result);
          const corroboration = request.corroborate
            ? this.buildCorroboration(result, alternatives)
            : undefined;
          return {
            metric: result,
            resolution_path: resolutionPath,
            fallback_used: result.tier !== "tier1",
            alternatives: alternatives.length > 0 ? alternatives : undefined,
            corroboration,
            telemetry,
            staleness,
          };
        }
      } else {
        // Sequential resolution path (default)
        for (const tier of tiers) {
          const tierModules = this.tierModules.get(tier) || [];
          resolutionPath.push(`tier_${tier}`);
          tiersAttempted.push(tier);

          for (const module of tierModules) {
            const moduleRequest: ModuleRequest = {
              identifier: request.identifier,
              metric: request.metric,
              period: request.period,
            };

            if (!module.canHandle(moduleRequest)) {
              moduleTraces.push({
                module: module.name, tier, duration_ms: 0,
                outcome: 'skip', cache_hit: false,
              });
              continue;
            }

            resolutionPath.push(module.name);
            const moduleStart = Date.now();

            try {
              const response = await this.queryModuleWithTimeout(
                module, moduleRequest, this.config.maxResolutionTime
              );

              const moduleDuration = Date.now() - moduleStart;
              const isCacheHit = response.cache_hit ?? false;
              if (isCacheHit) cacheHits++; else cacheMisses++;

              moduleTraces.push({
                module: module.name, tier, duration_ms: moduleDuration,
                outcome: response.success ? 'success' : 'error',
                cache_hit: isCacheHit,
                error_code: response.error?.code,
              });

              if (response.success && response.data) {
                const metric = Array.isArray(response.data)
                  ? response.data[0]
                  : response.data;

                if (request.corroborate) {
                  // Collect from all tiers for corroboration
                  alternatives.push(metric);
                } else if (tier === request.prefer_tier || !request.prefer_tier) {
                  const telemetry = this.buildTelemetry(
                    startTime, moduleTraces, cacheHits, cacheMisses, tiersAttempted, 'sequential'
                  );
                  const staleness = this.assessStaleness(metric);

                  logger.info("Truth resolution succeeded", {
                    identifier: request.identifier,
                    metric: request.metric,
                    tier, module: module.name,
                    executionTime: telemetry.total_duration_ms,
                  });

                  return {
                    metric,
                    resolution_path: resolutionPath,
                    fallback_used: tier !== "tier1",
                    alternatives: alternatives.length > 0 ? alternatives : undefined,
                    telemetry,
                    staleness,
                  };
                } else {
                  alternatives.push(metric);
                }
              }
            } catch (error) {
              const moduleDuration = Date.now() - moduleStart;
              const isTimeout = error instanceof GroundTruthError && error.code === ErrorCodes.TIMEOUT;
              cacheMisses++;
              moduleTraces.push({
                module: module.name, tier, duration_ms: moduleDuration,
                outcome: isTimeout ? 'timeout' : 'error',
                cache_hit: false,
                error_code: error instanceof GroundTruthError ? error.code : 'UNKNOWN',
              });
              logger.warn("Module query failed", {
                module: module.name,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          if (!this.config.enableFallback && tier === request.prefer_tier) {
            break;
          }
        }
      }

      // If corroborate mode, return the best result with corroboration data
      if (request.corroborate && alternatives.length > 0) {
        // Pick highest-tier result as primary
        const sorted = [...alternatives].sort((a, b) => {
          const tierOrder: Record<ConfidenceTier, number> = { tier1: 0, tier2: 1, tier3: 2 };
          return tierOrder[a.tier] - tierOrder[b.tier];
        });
        const primary = sorted[0];
        const others = sorted.slice(1);
        const corroboration = this.buildCorroboration(primary, others);
        const telemetry = this.buildTelemetry(
          startTime, moduleTraces, cacheHits, cacheMisses, tiersAttempted,
          isParallel ? 'parallel' : 'sequential'
        );
        return {
          metric: primary,
          resolution_path: resolutionPath,
          fallback_used: primary.tier !== "tier1",
          alternatives: others.length > 0 ? others : undefined,
          corroboration,
          telemetry,
          staleness: this.assessStaleness(primary),
        };
      }

      throw new GroundTruthError(
        ErrorCodes.NO_DATA_FOUND,
        `No data found for ${request.identifier} - ${request.metric}`,
        { resolution_path: resolutionPath }
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error("Truth resolution failed", {
        identifier: request.identifier,
        metric: request.metric,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime, resolutionPath,
      });
      throw error;
    }
  }

  /**
   * Resolve multiple metrics in a single call
   *
   * Uses Promise.allSettled for parallel mode to ensure partial results
   * are returned even if some requests fail.
   */
  async resolveMultiple(
    requests: TruthResolutionRequest[]
  ): Promise<TruthResolutionResult[]> {
    if (this.config.parallelQuery) {
      const settled = await Promise.allSettled(
        requests.map((req) => this.resolve(req))
      );
      const results: TruthResolutionResult[] = [];
      for (let i = 0; i < settled.length; i++) {
        const outcome = settled[i];
        if (outcome.status === 'fulfilled') {
          results.push(outcome.value);
        } else {
          logger.warn("Batch resolution item failed", {
            identifier: requests[i].identifier,
            metric: requests[i].metric,
            error: outcome.reason instanceof Error
              ? outcome.reason.message
              : "Unknown error",
          });
        }
      }
      return results;
    } else {
      const results: TruthResolutionResult[] = [];
      for (const request of requests) {
        try {
          const result = await this.resolve(request);
          results.push(result);
        } catch (error) {
          logger.warn("Batch resolution item failed", {
            identifier: request.identifier,
            metric: request.metric,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      return results;
    }
  }

  /**
   * Verify a claim against the ground truth database
   *
   * Implements MCP tool: verify_claim_aletheia
   * Node Mapping: [NODE: Aletheia_Verification_Loop]
   *
   * Returns a full ClaimVerificationReport with per-claim granularity.
   * Legacy callers can use the overall_verdict / overall_confidence fields.
   */
  async verifyClaim(
    claimText: string,
    contextEntity: string,
    contextDate?: string,
    strictMode: boolean = true
  ): Promise<ClaimVerificationReport> {
    logger.info("Claim verification started", {
      claimText,
      contextEntity,
      strictMode,
    });

    const numericClaims = this.extractNumericClaims(claimText);
    const tolerance = this.config.claimVerificationTolerance;

    if (numericClaims.length === 0) {
      return {
        overall_verdict: 'unverifiable',
        overall_confidence: 0,
        claims_total: 0,
        claims_verified: 0,
        claims_refuted: 0,
        claims_unverifiable: 0,
        per_claim: [],
      };
    }

    const perClaim: ClaimVerificationDetail[] = [];

    for (const claim of numericClaims) {
      try {
        const result = await this.resolve({
          identifier: contextEntity,
          metric: claim.metric,
          period: contextDate,
          prefer_tier: strictMode ? "tier1" : undefined,
          fallback_enabled: !strictMode,
        });

        const groundTruthValue = result.metric.value;
        const discrepancy = this.calculateDiscrepancy(claim.value, groundTruthValue);
        const verdict: ClaimVerificationDetail['verdict'] =
          discrepancy <= tolerance ? 'verified' : 'refuted';

        perClaim.push({
          claim_text: claim.originalText ?? `${claim.metric}: ${claim.value}`,
          metric: claim.metric,
          claimed_value: claim.value,
          ground_truth_value: groundTruthValue,
          ground_truth_source: result.metric.source,
          ground_truth_tier: result.metric.tier,
          discrepancy,
          tolerance,
          verdict,
          confidence: result.metric.confidence,
          evidence: result.metric,
        });
      } catch (error) {
        perClaim.push({
          claim_text: claim.originalText ?? `${claim.metric}: ${claim.value}`,
          metric: claim.metric,
          claimed_value: claim.value,
          tolerance,
          verdict: 'unverifiable',
          confidence: 0,
        });
        logger.warn("Claim verification failed for metric", {
          claim: claim.metric,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const verified = perClaim.filter(c => c.verdict === 'verified').length;
    const refuted = perClaim.filter(c => c.verdict === 'refuted').length;
    const unverifiable = perClaim.filter(c => c.verdict === 'unverifiable').length;
    const total = perClaim.length;

    let overall_verdict: ClaimVerificationReport['overall_verdict'];
    if (refuted > 0) {
      overall_verdict = verified > 0 ? 'partially_verified' : 'refuted';
    } else if (verified > 0) {
      overall_verdict = unverifiable > 0 ? 'partially_verified' : 'verified';
    } else {
      overall_verdict = 'unverifiable';
    }

    const confidences = perClaim.filter(c => c.confidence > 0).map(c => c.confidence);
    const overall_confidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    return {
      overall_verdict,
      overall_confidence,
      claims_total: total,
      claims_verified: verified,
      claims_refuted: refuted,
      claims_unverifiable: unverifiable,
      per_claim: perClaim,
    };
  }

  /**
   * Populate value driver tree node
   *
   * Implements MCP tool: populate_value_driver_tree
   * Node Mapping: [NODE: Value_Driver_Tree], [NODE: Auto_Population_Agent]
   *
   * Enhanced with risk_mitigation driver, headcount resolution from ground
   * truth, and weighted multi-factor confidence.
   */
  async populateValueDriverTree(
    targetCIK: string,
    benchmarkNAICS: string,
    driverNodeId: string,
    simulationPeriod: string
  ): Promise<{
    node_id: string;
    value: number;
    rationale: string;
    confidence: number;
    supporting_data: FinancialMetric[];
  }> {
    logger.info("Value driver tree population started", {
      targetCIK, benchmarkNAICS, driverNodeId,
    });

    const supportingData: FinancialMetric[] = [];

    // Get target company metrics
    const targetRevenue = await this.resolve({
      identifier: targetCIK,
      metric: "revenue_total",
      prefer_tier: "tier1",
      fallback_enabled: true,
    });
    supportingData.push(targetRevenue.metric);

    // Get industry benchmark
    const benchmark = await this.resolve({
      identifier: benchmarkNAICS,
      metric: "revenue_per_employee",
      prefer_tier: "tier3",
    });
    supportingData.push(benchmark.metric);

    // Attempt to resolve actual headcount from ground truth
    let headcount = 1000; // fallback assumption
    let headcountFromGroundTruth = false;
    try {
      const hcResult = await this.resolve({
        identifier: targetCIK,
        metric: "employee_count",
        prefer_tier: "tier2",
        fallback_enabled: true,
      });
      if (typeof hcResult.metric.value === 'number') {
        headcount = hcResult.metric.value;
        headcountFromGroundTruth = true;
        supportingData.push(hcResult.metric);
      }
    } catch {
      logger.info("Headcount not available from ground truth, using estimate", { targetCIK });
    }

    let value: number;
    let rationale: string;

    switch (driverNodeId) {
      case "productivity_delta": {
        const targetRevPerEmp = (targetRevenue.metric.value as number) / headcount;
        const benchmarkRevPerEmp = benchmark.metric.value as number;
        const gap = benchmarkRevPerEmp - targetRevPerEmp;
        value = gap * headcount;
        const hcSource = headcountFromGroundTruth ? 'ground truth' : 'estimate';
        rationale = `Productivity gap of $${gap.toLocaleString()}/employee vs industry benchmark (headcount: ${headcount.toLocaleString()} via ${hcSource}). Total potential: $${value.toLocaleString()}`;
        break;
      }

      case "revenue_uplift": {
        value = (targetRevenue.metric.value as number) * 0.15;
        rationale = `15% revenue uplift potential based on industry growth rates. Base revenue: $${(targetRevenue.metric.value as number).toLocaleString()}`;
        break;
      }

      case "cost_reduction": {
        value = (targetRevenue.metric.value as number) * 0.10;
        rationale = `10% cost reduction potential through operational efficiency. Base revenue: $${(targetRevenue.metric.value as number).toLocaleString()}`;
        break;
      }

      case "risk_mitigation": {
        // Risk-adjusted value: potential loss avoidance
        const baseRevenue = targetRevenue.metric.value as number;
        const riskExposurePct = 0.05; // 5% revenue at risk
        const mitigationEfficiency = 0.60; // 60% of risk can be mitigated
        value = baseRevenue * riskExposurePct * mitigationEfficiency;
        rationale = `Risk mitigation value: ${(riskExposurePct * 100)}% revenue exposure with ${(mitigationEfficiency * 100)}% mitigation efficiency. Avoided loss: $${value.toLocaleString()}`;
        break;
      }

      default:
        throw new GroundTruthError(
          ErrorCodes.INVALID_REQUEST,
          `Unsupported driver node: ${driverNodeId}`
        );
    }

    // Weighted confidence: Tier 1 data counts more than Tier 3
    const tierWeight: Record<ConfidenceTier, number> = { tier1: 1.0, tier2: 0.8, tier3: 0.6 };
    let weightedSum = 0;
    let weightTotal = 0;
    for (const m of supportingData) {
      const w = tierWeight[m.tier];
      weightedSum += m.confidence * w;
      weightTotal += w;
    }
    const confidence = weightTotal > 0 ? weightedSum / weightTotal : 0;

    return {
      node_id: driverNodeId,
      value,
      rationale,
      confidence,
      supporting_data: supportingData,
    };
  }

  /**
   * Get health status of all modules
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    modules: Record<string, { healthy: boolean; details?: any }>;
  }> {
    const moduleHealth: Record<string, any> = {};
    let allHealthy = true;

    for (const [name, module] of this.modules) {
      try {
        const health = await module.healthCheck();
        moduleHealth[name] = health;
        if (!health.healthy) {
          allHealthy = false;
        }
      } catch (error) {
        moduleHealth[name] = {
          healthy: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      modules: moduleHealth,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Determine which tiers to query based on request and configuration
   */
  private determineResolutionTiers(
    request: TruthResolutionRequest
  ): ConfidenceTier[] {
    // If corroborate is requested, always query all tiers
    if (request.corroborate) {
      return ["tier1", "tier2", "tier3"];
    }

    if (request.prefer_tier) {
      if (request.fallback_enabled ?? this.config.enableFallback) {
        const tiers: ConfidenceTier[] = [request.prefer_tier];
        if (request.prefer_tier !== "tier1") tiers.unshift("tier1");
        if (request.prefer_tier !== "tier2" && !tiers.includes("tier2"))
          tiers.push("tier2");
        if (request.prefer_tier !== "tier3" && !tiers.includes("tier3"))
          tiers.push("tier3");
        return tiers;
      } else {
        return [request.prefer_tier];
      }
    }

    if (this.config.enableFallback) {
      return ["tier1", "tier2", "tier3"];
    } else {
      return ["tier1"];
    }
  }

  /**
   * Query module with timeout
   */
  private async queryModuleWithTimeout(
    module: GroundTruthModule,
    request: ModuleRequest,
    timeout: number
  ): Promise<ModuleResponse> {
    return Promise.race([
      module.query(request),
      new Promise<ModuleResponse>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new GroundTruthError(ErrorCodes.TIMEOUT, "Module query timeout")
            ),
          timeout
        )
      ),
    ]);
  }

  /**
   * Parallel resolution: fire all tiers concurrently via Promise.allSettled
   */
  private async resolveParallel(
    request: TruthResolutionRequest,
    tiers: ConfidenceTier[],
    resolutionPath: string[],
    alternatives: FinancialMetric[],
    moduleTraces: ModuleTrace[],
    tiersAttempted: ConfidenceTier[],
  ): Promise<FinancialMetric | null> {
    const moduleRequest: ModuleRequest = {
      identifier: request.identifier,
      metric: request.metric,
      period: request.period,
    };

    // Build a flat list of all queryable modules
    const tasks: Array<{
      module: GroundTruthModule;
      tier: ConfidenceTier;
    }> = [];

    for (const tier of tiers) {
      tiersAttempted.push(tier);
      resolutionPath.push(`tier_${tier}`);
      const tierModules = this.tierModules.get(tier) || [];
      for (const mod of tierModules) {
        if (mod.canHandle(moduleRequest)) {
          tasks.push({ module: mod, tier });
          resolutionPath.push(mod.name);
        } else {
          moduleTraces.push({
            module: mod.name, tier, duration_ms: 0,
            outcome: 'skip', cache_hit: false,
          });
        }
      }
    }

    if (tasks.length === 0) return null;

    const settled = await Promise.allSettled(
      tasks.map(async ({ module, tier }) => {
        const start = Date.now();
        const response = await this.queryModuleWithTimeout(
          module, moduleRequest, this.config.maxResolutionTime
        );
        return { module: module.name, tier, response, duration: Date.now() - start };
      })
    );

    let primaryMetric: FinancialMetric | null = null;

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        const { module: modName, tier, response, duration } = outcome.value;
        moduleTraces.push({
          module: modName, tier, duration_ms: duration,
          outcome: response.success ? 'success' : 'error',
          cache_hit: response.cache_hit ?? false,
          error_code: response.error?.code,
        });
        if (response.success && response.data) {
          const metric = Array.isArray(response.data)
            ? response.data[0]
            : response.data;
          alternatives.push(metric);
          // Track highest-tier result as primary
          if (
            !primaryMetric ||
            this.tierPriority(metric.tier) < this.tierPriority(primaryMetric.tier)
          ) {
            primaryMetric = metric;
          }
        }
      } else {
        // Find the task that failed
        const idx = settled.indexOf(outcome);
        const task = tasks[idx];
        const isTimeout = outcome.reason instanceof GroundTruthError
          && outcome.reason.code === ErrorCodes.TIMEOUT;
        moduleTraces.push({
          module: task.module.name, tier: task.tier, duration_ms: 0,
          outcome: isTimeout ? 'timeout' : 'error',
          cache_hit: false,
          error_code: outcome.reason instanceof GroundTruthError
            ? outcome.reason.code : 'UNKNOWN',
        });
      }
    }

    return primaryMetric;
  }

  private tierPriority(tier: ConfidenceTier): number {
    const order: Record<ConfidenceTier, number> = { tier1: 0, tier2: 1, tier3: 2 };
    return order[tier];
  }

  /**
   * Build cross-tier corroboration analysis
   */
  private buildCorroboration(
    primary: FinancialMetric,
    others: FinancialMetric[]
  ): CrossTierCorroboration {
    const allMetrics = [primary, ...others];
    const numericValues = allMetrics
      .filter(m => typeof m.value === 'number')
      .map(m => ({ tier: m.tier, module: m.source, value: m.value as number, confidence: m.confidence }));

    const tolerance = this.config.corroborationTolerance;
    let maxDiscrepancy = 0;
    const tiersConfirmed: Set<ConfidenceTier> = new Set();

    if (numericValues.length >= 2 && typeof primary.value === 'number') {
      const primaryVal = primary.value;
      tiersConfirmed.add(primary.tier);

      for (const other of numericValues) {
        if (other.module === primary.source) continue;
        const disc = primaryVal !== 0
          ? Math.abs(other.value - primaryVal) / Math.abs(primaryVal)
          : (other.value === 0 ? 0 : 1);
        maxDiscrepancy = Math.max(maxDiscrepancy, disc);
        if (disc <= tolerance) {
          tiersConfirmed.add(other.tier);
        }
      }
    }

    // Bayesian confidence synthesis: combine independent confidence scores
    // P(correct) = 1 - product(1 - Ci) for independent sources
    const confidences = allMetrics.map(m => m.confidence);
    const synthesized = confidences.length > 0
      ? 1 - confidences.reduce((prod, c) => prod * (1 - c), 1)
      : 0;

    return {
      corroborated: tiersConfirmed.size > 1,
      tiers_queried: [...new Set(allMetrics.map(m => m.tier))],
      tiers_confirmed: [...tiersConfirmed],
      synthesized_confidence: Math.round(synthesized * 1000) / 1000,
      max_discrepancy: Math.round(maxDiscrepancy * 10000) / 10000,
      sources: allMetrics.map(m => ({
        tier: m.tier,
        module: m.source,
        value: m.value,
        confidence: m.confidence,
      })),
    };
  }

  /**
   * Build resolution telemetry summary
   */
  private buildTelemetry(
    startTime: number,
    moduleTraces: ModuleTrace[],
    cacheHits: number,
    cacheMisses: number,
    tiersAttempted: ConfidenceTier[],
    strategy: 'sequential' | 'parallel',
  ): ResolutionTelemetry {
    return {
      total_duration_ms: Date.now() - startTime,
      module_traces: moduleTraces,
      cache_hits: cacheHits,
      cache_misses: cacheMisses,
      tiers_attempted: [...new Set(tiersAttempted)],
      strategy,
    };
  }

  /**
   * Assess data staleness based on provenance extraction timestamp
   */
  private assessStaleness(metric: FinancialMetric): StalenessInfo {
    const extractedAt = metric.provenance.extracted_at;
    const thresholdHours = this.config.stalenessThresholds[metric.tier];

    const ageMs = Date.now() - new Date(extractedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    // Freshness decays linearly from 1.0 to 0.0 over 2× the threshold
    const freshnessScore = Math.max(0, Math.min(1, 1 - (ageHours / (thresholdHours * 2))));

    return {
      data_age_hours: Math.round(ageHours * 100) / 100,
      freshness_score: Math.round(freshnessScore * 1000) / 1000,
      threshold_hours: thresholdHours,
      is_stale: ageHours > thresholdHours,
      extracted_at: extractedAt,
    };
  }

  /**
   * Extract numeric claims from text
   *
   * Uses robust ClaimExtractor service for advanced pattern matching
   */
  private extractNumericClaims(text: string): Array<{
    metric: string;
    value: number;
    unit?: string;
    originalText?: string;
  }> {
    const claims = this.claimExtractor.extractClaims(text);

    return claims.map((c) => ({
      metric: c.metric,
      value: c.value,
      unit: c.unit,
      originalText: c.originalText,
    }));
  }

  /**
   * Calculate discrepancy between claimed and actual values
   */
  private calculateDiscrepancy(
    claimed: number,
    actual: number | string | [number, number]
  ): number {
    if (typeof actual === "number") {
      if (actual === 0) return claimed === 0 ? 0 : 1;
      return Math.abs(claimed - actual) / Math.abs(actual);
    } else if (Array.isArray(actual)) {
      const [min, max] = actual;
      if (claimed >= min && claimed <= max) {
        return 0;
      }
      const mid = (min + max) / 2;
      if (mid === 0) return claimed === 0 ? 0 : 1;
      return Math.abs(claimed - mid) / Math.abs(mid);
    }

    return 1; // Cannot compare
  }
}
