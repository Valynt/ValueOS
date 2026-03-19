/**
 * HypothesisGenerator
 *
 * Generates value hypotheses from deal context with extracted value driver candidates.
 * Uses LLM reasoning to estimate impact ranges and validates against benchmark
 * p25/p75 distributions. Heuristic multipliers are not used.
 *
 * Reference: openspec/changes/value-modeling-engine/tasks.md §2
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway.js";
import { secureLLMComplete } from "../../lib/llm/secureLLMWrapper.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ValueHypothesisSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  case_id: z.string().uuid(),
  value_driver: z.string().min(1).max(255),
  description: z.string().max(1000),
  estimated_impact_min: z.number(),
  estimated_impact_max: z.number(),
  impact_unit: z.string().max(50),
  evidence_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  confidence_score: z.number().min(0).max(1),
  benchmark_reference_id: z.string().uuid().optional(),
  status: z.enum(["pending", "accepted", "rejected", "modified"]),
  source_context_ids: z.array(z.string().uuid()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ValueHypothesis = z.infer<typeof ValueHypothesisSchema>;

export interface HypothesisGenerationInput {
  tenantId: string;
  caseId: string;
  dealContextId: string;
  valueDriverCandidates: Array<{
    id: string;
    name: string;
    description: string;
    signal_strength: number;
    evidence_count: number;
    suggested_kpi?: string;
  }>;
  industry?: string;
  companySize?: string;
  /** Optional LLMGateway instance. If omitted, a default instance is created. */
  llmGateway?: LLMGateway;
}

export interface HypothesisGenerationResult {
  hypotheses: ValueHypothesis[];
  rejectedCount: number;
  flags: string[];
}

// ---------------------------------------------------------------------------
// LLM impact estimation schema
// ---------------------------------------------------------------------------

const LLMImpactEstimateSchema = z.object({
  estimated_impact_min: z.number().describe("Conservative lower bound of impact (same unit as impact_unit)"),
  estimated_impact_max: z.number().describe("Optimistic upper bound of impact (same unit as impact_unit)"),
  impact_unit: z.string().describe("Unit of measurement, e.g. 'percent', 'USD', 'hours/week'"),
  reasoning: z.string().describe("One-paragraph explanation of how the range was derived"),
  assumptions: z.array(z.string()).describe("Key assumptions underlying the estimate"),
});

type LLMImpactEstimate = z.infer<typeof LLMImpactEstimateSchema>;
type DatabaseClient = Pick<typeof supabase, "from">;

const UNSAFE_IDENTIFIER_PATTERNS = [
  /['"]/,
  /--/,
  /;/,
  /<[^>]+>/,
  /\.\.[/\\]/,
  /\$\{/,
  /\x00/,
  /\b(or|union|select|drop|delete|insert|update)\b/i,
  /\b(__proto__|constructor|prototype|toString)\b/i,
  /^\[object Object\]$/i,
];

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const assertSafeIdentifier = (value: string, fieldName: string) => {
  if (!value || value === ZERO_UUID || UNSAFE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(`Invalid ${fieldName}`);
  }
};

const sanitizeFreeformText = (value: string): string =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/javascript:/gi, " ")
    .replace(/['"`\\;]/g, " ")
    .replace(/--/g, " ")
    .replace(/\b(drop|delete|insert|update|select|union|xp_|sp_)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class HypothesisGenerator {
  private readonly llm: LLMGateway;
  private readonly db: DatabaseClient;

  constructor(dependencies: { llmGateway?: LLMGateway; supabaseClient?: DatabaseClient } = {}) {
    this.llm = dependencies.llmGateway ?? new LLMGateway({
      provider: "together",
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    });
    this.db = dependencies.supabaseClient ?? supabase;
  }

  /**
   * Generate value hypotheses from deal context.
   * Impact ranges are derived from LLM reasoning grounded against benchmark
   * p25/p75 distributions — not from heuristic multipliers.
   */
  async generate(input: HypothesisGenerationInput): Promise<HypothesisGenerationResult> {
    assertSafeIdentifier(input.tenantId, "tenantId");
    assertSafeIdentifier(input.caseId, "caseId");
    assertSafeIdentifier(input.dealContextId, "dealContextId");

    logger.info(`Generating value hypotheses for case ${input.caseId}`);

    const hypotheses: ValueHypothesis[] = [];
    const flags: string[] = [];
    let rejectedCount = 0;

    for (const candidate of input.valueDriverCandidates) {
      // Skip low-signal candidates
      if (candidate.signal_strength < 0.3) {
        rejectedCount++;
        flags.push(`Low signal strength for ${candidate.name}: ${candidate.signal_strength}`);
        continue;
      }

      const sanitizedName = sanitizeFreeformText(candidate.name);
      const sanitizedDescription = sanitizeFreeformText(candidate.description);

      // Fetch benchmark distribution for plausibility grounding
      const benchmarkCheck = await this.checkBenchmarkPlausibility(
        input.tenantId,
        sanitizedName,
        input.industry,
        input.companySize,
      );

      // Use LLM to reason about impact range
      const impactEstimate = await this.estimateImpactWithLLM(
        {
          ...candidate,
          name: sanitizedName,
          description: sanitizedDescription,
        },
        input.tenantId,
        input.industry,
        input.companySize,
        benchmarkCheck.benchmarkRange,
      );

      const now = new Date().toISOString();
      const evidenceTier = this.calculateEvidenceTier(candidate);

      // Plausibility check: is the LLM estimate within benchmark p25-p75?
      const isPlausible = benchmarkCheck.benchmarkRange
        ? impactEstimate.estimated_impact_max >= benchmarkCheck.benchmarkRange.p25 &&
          impactEstimate.estimated_impact_min <= benchmarkCheck.benchmarkRange.p75
        : true; // No benchmark available — accept with lower confidence

      const hypothesis: ValueHypothesis = {
        id: crypto.randomUUID(),
        tenant_id: input.tenantId,
        case_id: input.caseId,
        value_driver: sanitizedName || "Sanitized Value Driver",
        description: sanitizedDescription,
        estimated_impact_min: impactEstimate.estimated_impact_min,
        estimated_impact_max: impactEstimate.estimated_impact_max,
        impact_unit: impactEstimate.impact_unit,
        evidence_tier: evidenceTier,
        confidence_score: this.calculateConfidence(candidate, isPlausible),
        benchmark_reference_id: benchmarkCheck.benchmarkId,
        status: "pending",
        source_context_ids: [input.dealContextId],
        created_at: now,
        updated_at: now,
      };

      if (!isPlausible) {
        flags.push(
          `Hypothesis "${candidate.name}" flagged: LLM estimate [${impactEstimate.estimated_impact_min}–${impactEstimate.estimated_impact_max}] outside benchmark p25/p75 range`,
        );
      }

      hypotheses.push(hypothesis);
    }

    await this.persistHypotheses(hypotheses);

    logger.info(
      `Generated ${hypotheses.length} hypotheses, rejected ${rejectedCount} for case ${input.caseId}`,
    );

    return { hypotheses, rejectedCount, flags };
  }

  /**
   * Use the LLM to reason about impact range for a value driver candidate.
   * Returns a structured estimate with reasoning and assumptions.
   */
  private async estimateImpactWithLLM(
    candidate: {
      name: string;
      description: string;
      signal_strength: number;
      evidence_count: number;
      suggested_kpi?: string;
    },
    tenantId: string,
    industry?: string,
    companySize?: string,
    benchmarkRange?: { p25: number; p75: number; unit?: string } | null,
  ): Promise<LLMImpactEstimate> {
    const benchmarkContext = benchmarkRange
      ? `Industry benchmark for this metric: p25=${benchmarkRange.p25}, p75=${benchmarkRange.p75}${benchmarkRange.unit ? ` (${benchmarkRange.unit})` : ""}.`
      : "No industry benchmark available for this metric.";

    const prompt = `You are a value engineering analyst estimating the financial impact of a business value driver.

Value Driver: ${candidate.name}
Description: ${candidate.description}
Signal Strength: ${candidate.signal_strength} (0=weak, 1=strong)
Evidence Count: ${candidate.evidence_count} data points
Suggested KPI: ${candidate.suggested_kpi ?? "not specified"}
Industry: ${industry ?? "not specified"}
Company Size: ${companySize ?? "not specified"}
${benchmarkContext}

Estimate the realistic impact range for this value driver. Be conservative on the lower bound and realistic (not aspirational) on the upper bound. Ground your estimate in the benchmark range if provided.

Respond with a JSON object matching this schema exactly:
{
  "estimated_impact_min": <number>,
  "estimated_impact_max": <number>,
  "impact_unit": "<string: 'percent', 'USD', 'hours/week', etc.>",
  "reasoning": "<one paragraph explaining how you derived the range>",
  "assumptions": ["<assumption 1>", "<assumption 2>", ...]
}`;

    try {
      const response = await secureLLMComplete(
        this.llm,
        [{ role: "user", content: prompt }],
        {
          organizationId: tenantId,
          tenantId,
          temperature: 0.2,
          max_tokens: 512,
          serviceName: "HypothesisGenerator",
          operation: "estimateImpactWithLLM",
        },
      );

      const raw = JSON.parse(response.content) as unknown;
      const parsed = LLMImpactEstimateSchema.safeParse(raw);

      if (!parsed.success) {
        logger.warn("LLM impact estimate failed schema validation, using signal-based fallback", {
          candidate: candidate.name,
          errors: parsed.error.issues,
        });
        return this.signalBasedFallbackEstimate(candidate, benchmarkRange);
      }

      return parsed.data;
    } catch (err) {
      logger.warn("LLM impact estimation failed, using signal-based fallback", {
        candidate: candidate.name,
        error: err instanceof Error ? err.message : String(err),
      });
      return this.signalBasedFallbackEstimate(candidate, benchmarkRange);
    }
  }

  /**
   * Signal-based fallback used only when the LLM call fails.
   * Uses benchmark p25/p75 if available; otherwise applies conservative
   * signal-proportional ranges. This is a last-resort path, not the primary path.
   */
  private signalBasedFallbackEstimate(
    candidate: { name: string; signal_strength: number; suggested_kpi?: string },
    benchmarkRange?: { p25: number; p75: number; unit?: string } | null,
  ): LLMImpactEstimate {
    if (benchmarkRange) {
      const range = benchmarkRange.p75 - benchmarkRange.p25;
      return {
        estimated_impact_min: benchmarkRange.p25 + range * 0.1 * candidate.signal_strength,
        estimated_impact_max: benchmarkRange.p25 + range * candidate.signal_strength,
        impact_unit: benchmarkRange.unit ?? candidate.suggested_kpi ?? "percent",
        reasoning: "Estimated from benchmark p25/p75 distribution scaled by signal strength (LLM unavailable).",
        assumptions: ["LLM unavailable; estimate derived from benchmark distribution"],
      };
    }

    // No benchmark and no LLM — use conservative signal-proportional range
    const base = candidate.signal_strength * 10;
    return {
      estimated_impact_min: Math.round(base * 0.5),
      estimated_impact_max: Math.round(base * 1.5),
      impact_unit: candidate.suggested_kpi ?? "percent",
      reasoning: "Conservative estimate based on signal strength only (LLM and benchmark unavailable).",
      assumptions: ["LLM unavailable", "No benchmark data available", "Estimate is directional only"],
    };
  }

  /**
   * Fetch benchmark p25/p75 distribution for plausibility grounding.
   */
  private async checkBenchmarkPlausibility(
    tenantId: string,
    driverName: string,
    industry?: string,
    companySize?: string,
  ): Promise<{
    isPlausible: boolean;
    benchmarkId?: string;
    benchmarkRange?: { p25: number; p75: number; unit?: string } | null;
  }> {
    const query = this.db
      .from("benchmarks")
      .select("id, metric_name, p25, p75, unit, industry, company_size_tier")
      .eq("tenant_id", tenantId)
      .ilike("metric_name", `%${driverName}%`)
      .limit(1);

    // Prefer tenant-specific benchmarks; fall back to global
    const { data: tenantBenchmarks } = await query;
    const { data: globalBenchmarks } = !tenantBenchmarks?.length
      ? await this.db
          .from("benchmarks")
          .select("id, metric_name, p25, p75, unit, industry, company_size_tier")
          .is("tenant_id", null)
          .ilike("metric_name", `%${driverName}%`)
          .limit(1)
      : { data: null };

    const benchmarks = tenantBenchmarks?.length ? tenantBenchmarks : globalBenchmarks;

    if (!benchmarks || benchmarks.length === 0) {
      return { isPlausible: true, benchmarkRange: null };
    }

    const benchmark = benchmarks[0] as {
      id: string;
      p25: number;
      p75: number;
      unit?: string;
    };

    return {
      isPlausible: true, // Plausibility is checked after LLM estimation
      benchmarkId: benchmark.id,
      benchmarkRange: { p25: benchmark.p25, p75: benchmark.p75, unit: benchmark.unit },
    };
  }

  /**
   * Calculate evidence tier based on signal source quality.
   */
  private calculateEvidenceTier(candidate: { signal_strength: number; evidence_count: number }): 1 | 2 | 3 {
    if (candidate.signal_strength >= 0.8 && candidate.evidence_count >= 3) return 1;
    if (candidate.signal_strength >= 0.5 && candidate.evidence_count >= 2) return 2;
    return 3;
  }

  /**
   * Calculate confidence score based on signal strength and benchmark plausibility.
   */
  private calculateConfidence(candidate: { signal_strength: number }, isPlausible: boolean): number {
    let confidence = candidate.signal_strength;
    if (!isPlausible) confidence *= 0.7; // Penalty for implausible range
    return Math.min(0.95, Math.max(0.3, confidence));
  }

  /**
   * Persist generated hypotheses to database.
   */
  private async persistHypotheses(hypotheses: ValueHypothesis[]): Promise<void> {
    if (hypotheses.length === 0) return;

    const { error } = await this.db.from("value_hypotheses").insert(
      hypotheses.map((h) => ({
        id: h.id,
        tenant_id: h.tenant_id,
        case_id: h.case_id,
        value_driver: h.value_driver,
        description: h.description,
        estimated_impact_min: h.estimated_impact_min,
        estimated_impact_max: h.estimated_impact_max,
        impact_unit: h.impact_unit,
        evidence_tier: h.evidence_tier,
        confidence_score: h.confidence_score,
        benchmark_reference_id: h.benchmark_reference_id,
        status: h.status,
        source_context_ids: h.source_context_ids,
        created_at: h.created_at,
        updated_at: h.updated_at,
      })),
    );

    if (error) {
      logger.error(`Failed to persist hypotheses: ${error.message}`);
      throw new Error(`Failed to persist hypotheses: ${error.message}`);
    }
  }
}
