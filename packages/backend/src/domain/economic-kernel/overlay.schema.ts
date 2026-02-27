/**
 * Domain Overlay Interface Contract
 *
 * Defines the strict contract for domain packs that overlay the canonical
 * economic kernel. Overlays can override KPI semantics, financial defaults,
 * risk models, benchmarks, and narrative — but never the underlying math.
 *
 * Validated with Zod at pack load time. Invalid overlays are rejected.
 */

import { z } from 'zod';
import { MetricCategory, MetricUnit, AggregationMethod, DriverCategory } from './kpi_registry.js';

// ─── KPI Override ────────────────────────────────────────────────────────────

export const KPIOverrideSchema = z.object({
  /** UUID of the canonical metric being overridden */
  metricId: z.string().uuid(),
  /** Domain-specific display name (e.g., "NIM Expansion" for banking) */
  displayName: z.string().min(1).optional(),
  /** Domain-specific description */
  description: z.string().optional(),
  /** Override the default unit if the domain uses a different convention */
  unitOverride: MetricUnit.optional(),
  /** Override aggregation method */
  aggregationOverride: AggregationMethod.optional(),
  /** Override valid range for domain-specific constraints */
  validRangeOverride: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  /** Domain-specific tags for filtering/grouping */
  tags: z.array(z.string()).optional(),
});

export type KPIOverride = z.infer<typeof KPIOverrideSchema>;

// ─── Financial Profile ───────────────────────────────────────────────────────

export const FinancialProfileSchema = z.object({
  /** Default discount rate for this domain (as decimal, e.g., 0.10) */
  defaultDiscountRate: z.number().min(0).max(1).optional(),
  /** Justification for the default discount rate */
  discountRateJustification: z.string().optional(),
  /** Default time horizon in years */
  defaultTimeHorizonYears: z.number().int().positive().optional(),
  /** Default currency code (ISO 4217) */
  defaultCurrency: z.string().length(3).optional(),
  /** Cost of capital override */
  costOfCapital: z.number().min(0).max(1).optional(),
  /** Domain-specific financial assumptions */
  assumptions: z.record(z.string(), z.number()).optional(),
});

export type FinancialProfile = z.infer<typeof FinancialProfileSchema>;

// ─── Risk Model Override ─────────────────────────────────────────────────────

export const RiskOverrideSchema = z.object({
  /** Risk category identifier */
  categoryId: z.string().min(1),
  /** Domain-specific risk category name */
  categoryName: z.string().min(1),
  /** Default weight for this risk category (0-1) */
  defaultWeight: z.number().min(0).max(1),
  /** Risk factors within this category */
  factors: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    defaultScore: z.number().min(0).max(1),
    weight: z.number().min(0).max(1),
  })),
});

export type RiskOverride = z.infer<typeof RiskOverrideSchema>;

// ─── Benchmark Source ────────────────────────────────────────────────────────

export const BenchmarkSourceSchema = z.object({
  /** Metric ID this benchmark applies to */
  metricId: z.string().uuid(),
  /** Source name (e.g., "Federal Reserve", "Gartner") */
  source: z.string().min(1),
  /** Source URL for provenance */
  sourceUrl: z.string().url().optional(),
  /** When the benchmark data was last updated */
  dataDate: z.string().datetime(),
  /** Refresh cadence in days */
  refreshCadenceDays: z.number().int().positive().optional(),
  /** Percentile values */
  percentiles: z.object({
    p25: z.number().optional(),
    p50: z.number().optional(),
    p75: z.number().optional(),
    p90: z.number().optional(),
  }),
  /** Sample size for statistical validity */
  sampleSize: z.number().int().positive().optional(),
  /** Confidence level */
  confidenceLevel: z.enum(['low', 'medium', 'high']).optional(),
  /** Industry/segment filter */
  segment: z.string().optional(),
});

export type BenchmarkSource = z.infer<typeof BenchmarkSourceSchema>;

// ─── Narrative Overrides ─────────────────────────────────────────────────────

export const NarrativeOverridesSchema = z.object({
  /** Domain-specific terminology mapping (neutral_term → domain_term) */
  terminology: z.record(z.string(), z.string()).optional(),
  /** Domain-specific report section templates */
  reportSections: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateKey: z.string().min(1),
  })).optional(),
});

export type NarrativeOverrides = z.infer<typeof NarrativeOverridesSchema>;

// ─── Governance Metadata ─────────────────────────────────────────────────────

export const GovernanceMetadataSchema = z.object({
  /** Whether this pack is for a regulated industry */
  regulated: z.boolean(),
  /** Regulatory frameworks this pack addresses */
  regulatoryFrameworks: z.array(z.string()).optional(),
  /** Required approval roles before activation */
  requiredApprovalRoles: z.array(z.string()).optional(),
  /** Limitation statements that must accompany outputs */
  limitationStatements: z.array(z.string()).optional(),
  /** Effective date — pack cannot be used before this date */
  effectiveDate: z.string().datetime().optional(),
  /** Expiry date — pack must be re-certified after this date */
  expiryDate: z.string().datetime().optional(),
  /** Source citations for assumptions and defaults */
  citations: z.array(z.object({
    claim: z.string().min(1),
    source: z.string().min(1),
    url: z.string().url().optional(),
    date: z.string().optional(),
  })).optional(),
});

export type GovernanceMetadata = z.infer<typeof GovernanceMetadataSchema>;

// ─── Domain Overlay (Top-Level Contract) ─────────────────────────────────────

export const DomainOverlaySchema = z.object({
  /** Unique overlay identifier */
  id: z.string().uuid(),
  /** Overlay name (e.g., "banking-v1") */
  name: z.string().min(1).regex(/^[a-z][a-z0-9-]*$/, 'Must be kebab-case'),
  /** Semantic version */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver (e.g., 1.0.0)'),
  /** Which canonical metric IDs this overlay applies to */
  appliesTo: z.array(z.string().uuid()).min(1),
  /** KPI semantic overrides */
  kpiOverrides: z.array(KPIOverrideSchema).optional(),
  /** Domain-specific financial defaults */
  financialDefaults: FinancialProfileSchema.optional(),
  /** Risk model overrides */
  riskModelOverrides: z.array(RiskOverrideSchema).optional(),
  /** Benchmark data sources */
  benchmarks: z.array(BenchmarkSourceSchema).optional(),
  /** Narrative/terminology overrides */
  narrative: NarrativeOverridesSchema.optional(),
  /** Governance and compliance metadata */
  governance: GovernanceMetadataSchema.optional(),
});

export type DomainOverlay = z.infer<typeof DomainOverlaySchema>;

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a domain overlay against the schema.
 * Returns the parsed overlay or throws a ZodError.
 */
export function validateOverlay(data: unknown): DomainOverlay {
  return DomainOverlaySchema.parse(data);
}

/**
 * Safe validation — returns success/error without throwing.
 */
export function safeValidateOverlay(data: unknown): z.SafeParseReturnType<unknown, DomainOverlay> {
  return DomainOverlaySchema.safeParse(data);
}

/**
 * Validate that all metricIds referenced in kpiOverrides exist in appliesTo.
 * This is a semantic check beyond schema validation.
 */
export function validateOverlayConsistency(overlay: DomainOverlay): string[] {
  const errors: string[] = [];
  const appliesToSet = new Set(overlay.appliesTo);

  // KPI overrides must reference metrics in appliesTo
  if (overlay.kpiOverrides) {
    for (const override of overlay.kpiOverrides) {
      if (!appliesToSet.has(override.metricId)) {
        errors.push(
          `KPI override references metric ${override.metricId} not in appliesTo`
        );
      }
    }
  }

  // Benchmark sources must reference metrics in appliesTo
  if (overlay.benchmarks) {
    for (const benchmark of overlay.benchmarks) {
      if (!appliesToSet.has(benchmark.metricId)) {
        errors.push(
          `Benchmark references metric ${benchmark.metricId} not in appliesTo`
        );
      }
    }
  }

  // Governance: if regulated, must have at least one regulatory framework
  if (overlay.governance?.regulated && (!overlay.governance.regulatoryFrameworks || overlay.governance.regulatoryFrameworks.length === 0)) {
    errors.push('Regulated overlay must specify at least one regulatory framework');
  }

  return errors;
}
