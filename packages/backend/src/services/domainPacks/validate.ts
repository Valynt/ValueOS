/**
 * Domain Pack Validation
 *
 * Pure validation functions for uniqueness, allowed values,
 * and prompt-injection guardrails on assumption values.
 */

import type {
  DomainPackAssumption,
  DomainPackKpi,
} from '../../api/domainPacks/types.js';

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// ============================================================================
// Allowed Units
// ============================================================================

/**
 * Allowed KPI units. Extensible — add entries as new domains are onboarded.
 */
export const ALLOWED_KPI_UNITS = new Set([
  '%', '$', 'hrs', 'bps', 'days', 'count', 'ratio',
  'USD', 'EUR', 'GBP', 'FTE', 'units', 'score',
]);

/**
 * Allowed assumption units.
 */
export const ALLOWED_ASSUMPTION_UNITS = new Set([
  '%', '$', 'years', 'months', 'days', 'hrs',
  'USD', 'EUR', 'GBP', 'bps', 'ratio', 'count', 'x',
]);

// ============================================================================
// Dangerous String Patterns
// ============================================================================

/**
 * Patterns that indicate prompt injection or template injection attempts.
 * These are checked against string-typed assumption values and text fields
 * that may later be interpolated into LLM prompts.
 */
const DANGEROUS_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\{\{.*\}\}/s, label: 'Handlebars template expression' },
  { pattern: /\$\{.*\}/s, label: 'Template literal expression' },
  { pattern: /<script[\s>]/i, label: 'Script tag' },
  { pattern: /javascript:/i, label: 'JavaScript URI' },
  { pattern: /\bSYSTEM\s*:/i, label: 'LLM system prompt marker' },
  { pattern: /\bignore\s+(previous|above|all)\s+instructions/i, label: 'Prompt injection' },
  { pattern: /\bdo\s+not\s+follow\b/i, label: 'Instruction override' },
  { pattern: /\bforget\s+(everything|all|your)\b/i, label: 'Memory wipe attempt' },
  { pattern: /\bact\s+as\b.*\b(admin|root|system)\b/i, label: 'Role escalation' },
];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check a string for dangerous patterns that could be exploited
 * when the value is interpolated into an LLM prompt.
 */
export function checkDangerousString(
  value: string,
  fieldPath: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    if (pattern.test(value)) {
      issues.push({
        field: fieldPath,
        message: `Blocked: ${label} detected`,
        severity: 'error',
      });
    }
  }

  return issues;
}

/**
 * Validate KPI uniqueness within a single pack's KPI list.
 */
export function validateKpiUniqueness(
  kpis: readonly DomainPackKpi[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const kpi of kpis) {
    if (seen.has(kpi.kpiKey)) {
      issues.push({
        field: `kpis[${kpi.kpiKey}]`,
        message: `Duplicate KPI key: "${kpi.kpiKey}"`,
        severity: 'error',
      });
    }
    seen.add(kpi.kpiKey);
  }

  return issues;
}

/**
 * Validate assumption uniqueness within a single pack's assumption list.
 */
export function validateAssumptionUniqueness(
  assumptions: readonly DomainPackAssumption[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const assumption of assumptions) {
    if (seen.has(assumption.assumptionKey)) {
      issues.push({
        field: `assumptions[${assumption.assumptionKey}]`,
        message: `Duplicate assumption key: "${assumption.assumptionKey}"`,
        severity: 'error',
      });
    }
    seen.add(assumption.assumptionKey);
  }

  return issues;
}

/**
 * Validate that KPI units are from the allowed set.
 * Returns warnings (not errors) for unknown units to allow extensibility.
 */
export function validateKpiUnits(
  kpis: readonly DomainPackKpi[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const kpi of kpis) {
    if (kpi.unit && !ALLOWED_KPI_UNITS.has(kpi.unit)) {
      issues.push({
        field: `kpis[${kpi.kpiKey}].unit`,
        message: `Unknown KPI unit: "${kpi.unit}". Allowed: ${[...ALLOWED_KPI_UNITS].join(', ')}`,
        severity: 'warning',
      });
    }
  }

  return issues;
}

/**
 * Validate that assumption units are from the allowed set.
 */
export function validateAssumptionUnits(
  assumptions: readonly DomainPackAssumption[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const assumption of assumptions) {
    if (assumption.unit && !ALLOWED_ASSUMPTION_UNITS.has(assumption.unit)) {
      issues.push({
        field: `assumptions[${assumption.assumptionKey}].unit`,
        message: `Unknown assumption unit: "${assumption.unit}". Allowed: ${[...ALLOWED_ASSUMPTION_UNITS].join(', ')}`,
        severity: 'warning',
      });
    }
  }

  return issues;
}

/**
 * Scan all string-typed assumption values and text fields for dangerous patterns.
 */
export function validateAssumptionSafety(
  assumptions: readonly DomainPackAssumption[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const assumption of assumptions) {
    // Check string values
    if (assumption.valueType === 'string' && assumption.valueText) {
      issues.push(
        ...checkDangerousString(
          assumption.valueText,
          `assumptions[${assumption.assumptionKey}].valueText`,
        ),
      );
    }

    // Check rationale text
    if (assumption.rationale) {
      issues.push(
        ...checkDangerousString(
          assumption.rationale,
          `assumptions[${assumption.assumptionKey}].rationale`,
        ),
      );
    }
  }

  return issues;
}

/**
 * Scan KPI text fields for dangerous patterns.
 */
export function validateKpiSafety(
  kpis: readonly DomainPackKpi[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const kpi of kpis) {
    if (kpi.description) {
      issues.push(
        ...checkDangerousString(kpi.description, `kpis[${kpi.kpiKey}].description`),
      );
    }
    if (kpi.baselineHint) {
      issues.push(
        ...checkDangerousString(kpi.baselineHint, `kpis[${kpi.kpiKey}].baselineHint`),
      );
    }
    if (kpi.targetHint) {
      issues.push(
        ...checkDangerousString(kpi.targetHint, `kpis[${kpi.kpiKey}].targetHint`),
      );
    }
  }

  return issues;
}

// ============================================================================
// LLM-Specific Guardrails
// ============================================================================

/**
 * Limits for pack content that flows into LLM prompts.
 * These prevent context window overflow and prompt degradation.
 */
export const LLM_LIMITS = {
  /** Max KPIs per pack. Beyond this, prompt quality degrades. */
  MAX_KPIS_PER_PACK: 50,
  /** Max assumptions per pack. */
  MAX_ASSUMPTIONS_PER_PACK: 50,
  /** Approximate token budget for the entire domain context prompt fragment. */
  MAX_PROMPT_TOKENS: 2000,
  /** Max characters for any single text field that enters a prompt. */
  MAX_FIELD_CHARS: 500,
} as const;

/**
 * Rough token estimate: ~4 chars per token for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Validate that pack size stays within LLM-safe limits.
 */
export function validateLlmLimits(
  kpis: readonly DomainPackKpi[],
  assumptions: readonly DomainPackAssumption[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (kpis.length > LLM_LIMITS.MAX_KPIS_PER_PACK) {
    issues.push({
      field: 'kpis',
      message: `Pack has ${kpis.length} KPIs, exceeding the limit of ${LLM_LIMITS.MAX_KPIS_PER_PACK}. This may degrade LLM prompt quality.`,
      severity: 'error',
    });
  }

  if (assumptions.length > LLM_LIMITS.MAX_ASSUMPTIONS_PER_PACK) {
    issues.push({
      field: 'assumptions',
      message: `Pack has ${assumptions.length} assumptions, exceeding the limit of ${LLM_LIMITS.MAX_ASSUMPTIONS_PER_PACK}. This may degrade LLM prompt quality.`,
      severity: 'error',
    });
  }

  // Check individual field lengths
  for (const kpi of kpis) {
    if (kpi.description && kpi.description.length > LLM_LIMITS.MAX_FIELD_CHARS) {
      issues.push({
        field: `kpis[${kpi.kpiKey}].description`,
        message: `Description is ${kpi.description.length} chars, exceeding ${LLM_LIMITS.MAX_FIELD_CHARS} char limit`,
        severity: 'warning',
      });
    }
  }

  for (const a of assumptions) {
    if (a.rationale && a.rationale.length > LLM_LIMITS.MAX_FIELD_CHARS) {
      issues.push({
        field: `assumptions[${a.assumptionKey}].rationale`,
        message: `Rationale is ${a.rationale.length} chars, exceeding ${LLM_LIMITS.MAX_FIELD_CHARS} char limit`,
        severity: 'warning',
      });
    }
    if (a.valueType === 'string' && a.valueText && a.valueText.length > LLM_LIMITS.MAX_FIELD_CHARS) {
      issues.push({
        field: `assumptions[${a.assumptionKey}].valueText`,
        message: `Value text is ${a.valueText.length} chars, exceeding ${LLM_LIMITS.MAX_FIELD_CHARS} char limit`,
        severity: 'warning',
      });
    }
  }

  return issues;
}

// ============================================================================
// Markdown / Backtick Stripping
// ============================================================================

/**
 * Strip markdown formatting that could interfere with LLM prompt structure.
 * Removes: triple backticks, markdown tables, HTML tags.
 */
export function stripPromptUnsafeMarkdown(text: string): string {
  let cleaned = text;

  // Remove triple backtick code fences (``` ... ```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '[code block removed]');

  // Remove single backtick inline code that might confuse prompt parsing
  // Only strip if it looks like it wraps executable content
  cleaned = cleaned.replace(/`[^`]{50,}`/g, '[long code removed]');

  // Remove markdown tables (lines starting with |)
  cleaned = cleaned.replace(/^\|.*\|$/gm, '[table row removed]');
  // Remove table separator lines (|---|---|)
  cleaned = cleaned.replace(/^\|[-:\s|]+\|$/gm, '');

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  return cleaned.trim();
}

/**
 * Sanitize all text fields in a KPI for safe prompt inclusion.
 */
export function sanitizeKpiForPrompt(kpi: DomainPackKpi): DomainPackKpi {
  return {
    ...kpi,
    description: kpi.description ? stripPromptUnsafeMarkdown(kpi.description) : kpi.description,
    baselineHint: kpi.baselineHint ? stripPromptUnsafeMarkdown(kpi.baselineHint) : kpi.baselineHint,
    targetHint: kpi.targetHint ? stripPromptUnsafeMarkdown(kpi.targetHint) : kpi.targetHint,
  };
}

/**
 * Sanitize all text fields in an assumption for safe prompt inclusion.
 */
export function sanitizeAssumptionForPrompt(assumption: DomainPackAssumption): DomainPackAssumption {
  return {
    ...assumption,
    rationale: assumption.rationale
      ? stripPromptUnsafeMarkdown(assumption.rationale)
      : assumption.rationale,
    valueText: assumption.valueType === 'string' && assumption.valueText
      ? stripPromptUnsafeMarkdown(assumption.valueText)
      : assumption.valueText,
  };
}

// ============================================================================
// Aggregate Validation
// ============================================================================

/**
 * Run all validations on a pack's KPIs and assumptions.
 * Returns all issues found; callers decide whether to block on errors.
 */
export function validatePack(
  kpis: readonly DomainPackKpi[],
  assumptions: readonly DomainPackAssumption[],
): ValidationIssue[] {
  return [
    ...validateKpiUniqueness(kpis),
    ...validateAssumptionUniqueness(assumptions),
    ...validateKpiUnits(kpis),
    ...validateAssumptionUnits(assumptions),
    ...validateKpiSafety(kpis),
    ...validateAssumptionSafety(assumptions),
    ...validateLlmLimits(kpis, assumptions),
  ];
}

/**
 * Returns true if any issue has severity 'error'.
 */
export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
