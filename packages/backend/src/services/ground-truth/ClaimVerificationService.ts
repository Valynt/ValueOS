/**
 * ClaimVerificationService
 *
 * Verifies claims (metric + value) against authoritative sources.
 * Returns match, contradiction, or unverifiable status with severity.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §6
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { XBRLParser, type XBRLFact } from "./XBRLParser.js";
import { benchmarkRetrievalService, type Benchmark } from "./BenchmarkRetrievalService.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const VerificationStatusSchema = z.enum(["match", "contradiction", "unverifiable"]);

export const VerificationSeveritySchema = z.enum(["none", "minor", "moderate", "major", "critical"]);

export const VerificationResultSchema = z.object({
  claim: z.object({
    metric: z.string(),
    value: z.number(),
    unit: z.string().optional(),
  }),
  status: VerificationStatusSchema,
  severity: VerificationSeveritySchema,
  authoritativeValue: z.number().optional(),
  deviation: z.number().optional(), // Percentage deviation from authoritative
  sources: z.array(z.object({
    name: z.string(),
    url: z.string().optional(),
    date: z.string(),
    tier: z.enum(["tier_1_sec", "tier_2_benchmark", "tier_3_internal"]),
  })),
  confidence: z.number(), // 0-1 confidence in the verification
  explanation: z.string(),
  verifiedAt: z.string(),
});

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type VerificationSeverity = z.infer<typeof VerificationSeveritySchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export interface Claim {
  metric: string;
  value: number;
  unit?: string;
  cik?: string; // For SEC verification
  industry?: string; // For benchmark verification
  companySize?: "small" | "medium" | "large" | "enterprise";
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ClaimVerificationService {
  private static instance: ClaimVerificationService;
  private xbrlParser: XBRLParser;

  private constructor() {
    this.xbrlParser = new XBRLParser();
  }

  static getInstance(): ClaimVerificationService {
    if (!ClaimVerificationService.instance) {
      ClaimVerificationService.instance = new ClaimVerificationService();
    }
    return ClaimVerificationService.instance;
  }

  /**
   * Verify a claim against authoritative sources
   */
  async verifyClaim(claim: Claim): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      // Try SEC data first (Tier 1) if CIK provided
      if (claim.cik) {
        const secResult = await this.verifyAgainstSEC(claim);
        if (secResult.status !== "unverifiable") {
          return secResult;
        }
      }

      // Try industry benchmarks (Tier 2) if industry provided
      if (claim.industry) {
        const benchmarkResult = await this.verifyAgainstBenchmarks(claim);
        if (benchmarkResult.status !== "unverifiable") {
          return benchmarkResult;
        }
      }

      // Unverifiable - penalize confidence
      return this.createUnverifiableResult(claim);
    } catch (error) {
      logger.error("Claim verification failed", {
        claim,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.createUnverifiableResult(claim, error);
    }
  }

  /**
   * Verify multiple claims in batch
   */
  async verifyClaims(claims: Claim[]): Promise<VerificationResult[]> {
    return Promise.all(claims.map((claim) => this.verifyClaim(claim)));
  }

  /**
   * Check if claim is feasible based on historical improvements
   */
  async assessFeasibility(claim: Claim, historicalValue?: number): Promise<{
    feasible: boolean;
    classification: "achievable" | "stretch" | "unrealistic";
    explanation: string;
  }> {
    if (!historicalValue || historicalValue === 0) {
      return {
        feasible: true,
        classification: "achievable",
        explanation: "No historical data available for feasibility assessment",
      };
    }

    const improvement = (claim.value - historicalValue) / historicalValue;

    // Classification thresholds based on typical business improvement patterns
    if (improvement <= 0.15) {
      return {
        feasible: true,
        classification: "achievable",
        explanation: `Improvement of ${(improvement * 100).toFixed(1)}% is within typical achievable range (0-15%)`,
      };
    } else if (improvement <= 0.30) {
      return {
        feasible: true,
        classification: "stretch",
        explanation: `Improvement of ${(improvement * 100).toFixed(1)}% is ambitious but achievable with significant effort (15-30%)`,
      };
    } else {
      return {
        feasible: false,
        classification: "unrealistic",
        explanation: `Improvement of ${(improvement * 100).toFixed(1)}% exceeds typical historical improvement patterns (>30%)`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  private async verifyAgainstSEC(claim: Claim): Promise<VerificationResult> {
    const metricMapping: Record<string, string[]> = {
      revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
      net_income: ["NetIncomeLoss", "ProfitLoss"],
      total_assets: ["Assets"],
      total_liabilities: ["Liabilities"],
      operating_income: ["OperatingIncomeLoss"],
      gross_profit: ["GrossProfit"],
    };

    const xbrlMetrics = metricMapping[claim.metric.toLowerCase()];
    if (!xbrlMetrics || !claim.cik) {
      return this.createUnverifiableResult(claim);
    }

    // Get the latest fact for this metric
    const fact = await this.xbrlParser.getMetricHistory(claim.cik, claim.metric.toLowerCase());

    if (!fact || fact.length === 0) {
      return this.createUnverifiableResult(claim);
    }

    const latestFact = fact[0];
    const authoritativeValue = latestFact.value;
    const deviation = Math.abs(claim.value - authoritativeValue) / authoritativeValue;

    // Determine status and severity based on deviation
    let status: VerificationStatus;
    let severity: VerificationSeverity;
    let explanation: string;

    if (deviation <= 0.05) {
      status = "match";
      severity = "none";
      explanation = `Claim matches SEC filing within 5% tolerance (deviation: ${(deviation * 100).toFixed(1)}%)`;
    } else if (deviation <= 0.15) {
      status = "contradiction";
      severity = "minor";
      explanation = `Claim shows minor variance from SEC filing (deviation: ${(deviation * 100).toFixed(1)}%)`;
    } else if (deviation <= 0.30) {
      status = "contradiction";
      severity = "moderate";
      explanation = `Claim shows moderate variance from SEC filing (deviation: ${(deviation * 100).toFixed(1)}%)`;
    } else {
      status = "contradiction";
      severity = "major";
      explanation = `Claim shows significant variance from SEC filing (deviation: ${(deviation * 100).toFixed(1)}%)`;
    }

    return {
      claim: {
        metric: claim.metric,
        value: claim.value,
        unit: claim.unit,
      },
      status,
      severity,
      authoritativeValue,
      deviation,
      sources: [{
        name: "SEC EDGAR XBRL",
        date: latestFact.filing_date,
        tier: "tier_1_sec",
      }],
      confidence: 0.95,
      explanation,
      verifiedAt: new Date().toISOString(),
    };
  }

  private async verifyAgainstBenchmarks(claim: Claim): Promise<VerificationResult> {
    if (!claim.industry) {
      return this.createUnverifiableResult(claim);
    }

    const benchmark = await benchmarkRetrievalService.retrieveBenchmark({
      industry: claim.industry,
      kpi: claim.metric.toLowerCase(),
      companySize: claim.companySize,
    });

    if (!benchmark) {
      return this.createUnverifiableResult(claim);
    }

    // Compare against p50 (median) and determine position
    const p50 = benchmark.distribution.p50;
    const p25 = benchmark.distribution.p25;
    const p75 = benchmark.distribution.p75;

    let status: VerificationStatus;
    let severity: VerificationSeverity;
    let explanation: string;
    let confidence: number;

    if (claim.value >= p25 && claim.value <= p75) {
      // Within interquartile range - reasonable
      status = "match";
      severity = "none";
      explanation = `Claim value falls within industry benchmark range (p25-p75)`;
      confidence = benchmark.confidence * 0.9;
    } else if (claim.value >= p25 * 0.8 && claim.value <= p75 * 1.2) {
      // Slightly outside range - minor deviation
      status = "match";
      severity = "minor";
      explanation = `Claim value is near industry benchmark range with minor variance`;
      confidence = benchmark.confidence * 0.8;
    } else if (claim.value < p25 * 0.5 || claim.value > p75 * 1.5) {
      // Significantly outside range
      status = "contradiction";
      severity = "moderate";
      explanation = `Claim value deviates significantly from industry benchmarks`;
      confidence = benchmark.confidence * 0.7;
    } else {
      status = "contradiction";
      severity = "minor";
      explanation = `Claim value shows moderate deviation from industry benchmarks`;
      confidence = benchmark.confidence * 0.75;
    }

    return {
      claim: {
        metric: claim.metric,
        value: claim.value,
        unit: claim.unit,
      },
      status,
      severity,
      sources: [{
        name: benchmark.source,
        date: benchmark.date,
        tier: "tier_2_benchmark",
      }],
      confidence,
      explanation,
      verifiedAt: new Date().toISOString(),
    };
  }

  private createUnverifiableResult(claim: Claim, error?: unknown): VerificationResult {
    let explanation = "No authoritative data available to verify this claim";
    if (error) {
      explanation += ` (Error: ${error instanceof Error ? error.message : String(error)})`;
    }

    return {
      claim: {
        metric: claim.metric,
        value: claim.value,
        unit: claim.unit,
      },
      status: "unverifiable",
      severity: "moderate",
      sources: [],
      confidence: 0.3, // Penalized confidence for unverifiable claims
      explanation,
      verifiedAt: new Date().toISOString(),
    };
  }
}

// Singleton export
export const claimVerificationService = ClaimVerificationService.getInstance();
