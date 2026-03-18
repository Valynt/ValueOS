import { z } from "zod";
import { getServiceConfigManager } from "../config/ServiceConfigManager.js";

/**
 * Source Classification Enforcement
 *
 * Zod schemas and validation for source classification.
 * Every assumption must have a source tag.
 * Every evidence item must have tier, freshness date, reliability score, transparency level, validation status.
 */

// Source tiers for evidence classification
export const SourceTier = z.enum([
  "tier_1_sec",
  "tier_2_benchmark",
  "tier_3_web",
  "tier_4_llm",
]);

export type SourceTier = z.infer<typeof SourceTier>;

// Transparency levels
export const TransparencyLevel = z.enum([
  "transparent",
  "opaque",
  "black_box",
]);

export type TransparencyLevel = z.infer<typeof TransparencyLevel>;

// Validation status
export const ValidationStatus = z.enum([
  "validated",
  "pending",
  "rejected",
]);

export type ValidationStatus = z.infer<typeof ValidationStatus>;

// Default max age in days for each tier (for freshness calculations)
export const DEFAULT_TIER_MAX_AGE_DAYS: Record<SourceTier, number> = {
  tier_1_sec: 365,      // 1 year for SEC filings
  tier_2_benchmark: 180, // 6 months for benchmarks
  tier_3_web: 90,        // 3 months for web sources
  tier_4_llm: 30,        // 1 month for LLM-generated
};

// Schema for configurable tier max ages
export const TierMaxAgeConfigSchema = z.object({
  tier_1_sec: z.number().min(1).default(365),
  tier_2_benchmark: z.number().min(1).default(180),
  tier_3_web: z.number().min(1).default(90),
  tier_4_llm: z.number().min(1).default(30),
});

export type TierMaxAgeConfig = z.infer<typeof TierMaxAgeConfigSchema>;

/**
 * Get tier max age configuration from ServiceConfigManager or environment
 */
export function getTierMaxAgeDays(): Record<SourceTier, number> {
  try {
    const configManager = getServiceConfigManager();
    const sourceConfig = configManager.getServiceConfig("sourceClassification");
    if (sourceConfig?.tierMaxAgeDays) {
      return TierMaxAgeConfigSchema.parse(sourceConfig.tierMaxAgeDays) as Record<SourceTier, number>;
    }
  } catch {
    // Fall back to defaults if config manager is not available
  }

  // Allow environment variable overrides
  const env = typeof process !== "undefined" ? process.env : {};
  return {
    tier_1_sec: env.TIER_1_MAX_AGE_DAYS ? parseInt(env.TIER_1_MAX_AGE_DAYS, 10) : DEFAULT_TIER_MAX_AGE_DAYS.tier_1_sec,
    tier_2_benchmark: env.TIER_2_MAX_AGE_DAYS ? parseInt(env.TIER_2_MAX_AGE_DAYS, 10) : DEFAULT_TIER_MAX_AGE_DAYS.tier_2_benchmark,
    tier_3_web: env.TIER_3_MAX_AGE_DAYS ? parseInt(env.TIER_3_MAX_AGE_DAYS, 10) : DEFAULT_TIER_MAX_AGE_DAYS.tier_3_web,
    tier_4_llm: env.TIER_4_MAX_AGE_DAYS ? parseInt(env.TIER_4_MAX_AGE_DAYS, 10) : DEFAULT_TIER_MAX_AGE_DAYS.tier_4_llm,
  };
}

// Backward-compatible export (now a getter function that returns the computed values)
export const TIER_MAX_AGE_DAYS: Record<SourceTier, number> = new Proxy({} as Record<SourceTier, number>, {
  get(target, prop) {
    return getTierMaxAgeDays()[prop as SourceTier];
  },
});

// Assumption schema - requires source tag
export const AssumptionSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  content: z.string().min(1),
  sourceTag: SourceTier, // Required - rejection if missing
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Assumption = z.infer<typeof AssumptionSchema>;

// Evidence schema - requires full classification
export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  assumptionId: z.string().uuid(),
  sourceTier: SourceTier,
  freshnessDate: z.date().refine(
    (date) => date <= new Date(),
    { message: "Freshness date cannot be in the future" }
  ),
  reliabilityScore: z.number().min(0).max(1),
  transparencyLevel: TransparencyLevel,
  validationStatus: ValidationStatus,
  sourceUrl: z.string().url().optional(),
  description: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

// Validation result
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodIssue[];
}

/**
 * Validate an assumption has required source classification
 */
export function validateAssumption(data: unknown): ValidationResult<Assumption> {
  const result = AssumptionSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        ...issue,
        message:
          issue.path.includes("sourceTag") && issue.code === "invalid_type"
            ? "Assumption must have a source tag (tier_1_sec, tier_2_benchmark, tier_3_web, or tier_4_llm)"
            : issue.message,
      })),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate evidence has required source classification fields
 */
export function validateEvidence(data: unknown): ValidationResult<Evidence> {
  const result = EvidenceSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      if (issue.path.includes("sourceTier")) {
        return { ...issue, message: "Evidence must specify source tier" };
      }
      if (issue.path.includes("freshnessDate")) {
        return { ...issue, message: "Evidence must have freshness date" };
      }
      if (issue.path.includes("reliabilityScore")) {
        return { ...issue, message: "Reliability score must be between 0 and 1" };
      }
      return issue;
    });

    return { success: false, errors };
  }

  return { success: true, data: result.data };
}

/**
 * Check if evidence has expired based on its tier
 */
export function isEvidenceExpired(
  evidence: Evidence,
  referenceDate: Date = new Date()
): boolean {
  const maxAgeMs = TIER_MAX_AGE_DAYS[evidence.sourceTier] * 24 * 60 * 60 * 1000;
  const ageMs = referenceDate.getTime() - evidence.freshnessDate.getTime();
  return ageMs > maxAgeMs;
}

/**
 * Calculate freshness penalty for expired evidence
 */
export function calculateFreshnessPenalty(
  evidence: Evidence,
  referenceDate: Date = new Date()
): number {
  if (!isEvidenceExpired(evidence, referenceDate)) {
    return 0;
  }

  const maxAgeMs = TIER_MAX_AGE_DAYS[evidence.sourceTier] * 24 * 60 * 60 * 1000;
  const ageMs = referenceDate.getTime() - evidence.freshnessDate.getTime();
  const monthsOverdue = Math.floor((ageMs - maxAgeMs) / (30 * 24 * 60 * 60 * 1000));

  // Cap penalty at 0.3
  return Math.min(0.3, monthsOverdue * 0.05);
}
