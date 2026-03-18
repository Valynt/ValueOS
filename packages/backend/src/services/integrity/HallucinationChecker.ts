/**
 * HallucinationChecker
 *
 * Parses financial figures from generated narrative text and cross-references
 * against economic kernel deterministic calculations. Flags discrepancies as
 * hallucinations with severity and location.
 *
 * Reference: openspec/changes/trust-layer-completion/tasks.md §5
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const HallucinationSeveritySchema = z.enum([
  "critical", // Blocks persistence
  "warning",  // Flagged but allowed
  "info",     // Minor discrepancy
]);
export type HallucinationSeverity = z.infer<typeof HallucinationSeveritySchema>;

export const HallucinationFlagSchema = z.object({
  id: z.string().uuid(),
  severity: HallucinationSeveritySchema,
  location: z.object({
    section: z.string(),
    paragraph: z.number().int(),
    sentence: z.number().int(),
  }),
  claim: z.object({
    text: z.string(),
    figure: z.number(),
    unit: z.string(),
    metric_name: z.string(),
  }),
  expected_value: z.number(),
  discrepancy_pct: z.number(),
  source_calculation: z.string(), // Reference to economic kernel formula
  suggested_fix: z.string(),
});

export type HallucinationFlag = z.infer<typeof HallucinationFlagSchema>;

export interface HallucinationCheckInput {
  narrativeText: string;
  caseId: string;
  scenarioId: string;
  tenantId: string;
  expectedFigures: Array<{
    metricName: string;
    value: number;
    unit: string;
    location: string; // dot-notation path in value tree
  }>;
}

export interface HallucinationCheckResult {
  flags: HallucinationFlag[];
  hasCritical: boolean;
  canPersist: boolean;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class HallucinationChecker {
  private readonly CRITICAL_THRESHOLD = 0.1; // 10% discrepancy
  private readonly WARNING_THRESHOLD = 0.05; // 5% discrepancy

  /**
   * Check narrative for hallucinated financial figures.
   */
  async check(input: HallucinationCheckInput): Promise<HallucinationCheckResult> {
    logger.info(`Checking narrative for case ${input.caseId} for hallucinations`);

    const flags: HallucinationFlag[] = [];

    // Parse figures from narrative text
    const parsedFigures = this.parseFiguresFromText(input.narrativeText);

    // Cross-reference each parsed figure against expected values
    for (const parsed of parsedFigures) {
      const expected = input.expectedFigures.find(
        (e) => e.metricName.toLowerCase() === parsed.metricName.toLowerCase() ||
               this.isRelatedMetric(e.metricName, parsed.metricName),
      );

      if (!expected) {
        // Figure in narrative not found in calculations - possible hallucination
        flags.push(this.createFlag(parsed, null, "warning", input.narrativeText));
        continue;
      }

      // Calculate discrepancy
      const discrepancyPct = Math.abs(parsed.value - expected.value) / expected.value;

      if (discrepancyPct > this.CRITICAL_THRESHOLD) {
        flags.push(this.createFlag(parsed, expected, "critical", input.narrativeText));
      } else if (discrepancyPct > this.WARNING_THRESHOLD) {
        flags.push(this.createFlag(parsed, expected, "warning", input.narrativeText));
      }
    }

    // Check for missing expected figures in narrative
    for (const expected of input.expectedFigures) {
      const found = parsedFigures.some(
        (p) => p.metricName.toLowerCase() === expected.metricName.toLowerCase() ||
               this.isRelatedMetric(expected.metricName, p.metricName),
      );

      if (!found && expected.value > 0) {
        // Expected figure not mentioned in narrative
        flags.push({
          id: crypto.randomUUID(),
          severity: "info",
          location: { section: "overall", paragraph: 0, sentence: 0 },
          claim: {
            text: `Missing: ${expected.metricName}`,
            figure: expected.value,
            unit: expected.unit,
            metric_name: expected.metricName,
          },
          expected_value: expected.value,
          discrepancy_pct: 1, // 100% missing
          source_calculation: expected.location,
          suggested_fix: `Add mention of ${expected.metricName}: ${expected.value}${expected.unit}`,
        });
      }
    }

    const hasCritical = flags.some((f) => f.severity === "critical");
    const result: HallucinationCheckResult = {
      flags,
      hasCritical,
      canPersist: !hasCritical, // Block persistence if critical hallucinations
      checkedAt: new Date().toISOString(),
    };

    logger.info(`Hallucination check complete for case ${input.caseId}: ${flags.length} flags, ${hasCritical ? "critical" : "ok"}`);

    return result;
  }

  /**
   * Parse financial figures from narrative text.
   */
  private parseFiguresFromText(text: string): Array<{
    value: number;
    unit: string;
    metricName: string;
    location: { paragraph: number; sentence: number };
  }> {
    const figures: Array<{
      value: number;
      unit: string;
      metricName: string;
      location: { paragraph: number; sentence: number };
    }> = [];

    const paragraphs = text.split(/\n\n+/);

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx];
      const sentences = paragraph.split(/[.!?]+/);

      for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
        const sentence = sentences[sIdx];

        // Match patterns like:
        // - "$1.2M" or "$1.2 million"
        // - "15% ROI" or "ROI of 15%"
        // - "$500K annual savings"
        // - "payback period of 8 months"

        // Currency patterns
        const currencyMatches = sentence.matchAll(
          /\$([\d,]+\.?\d*)\s*(M|million|K|k|thousand|B|billion)?/gi,
        );
        for (const match of currencyMatches) {
          const value = this.parseNumber(match[1]) * this.getMultiplier(match[2]);
          const context = this.extractMetricContext(sentence, match.index || 0);
          figures.push({
            value,
            unit: "USD",
            metricName: context,
            location: { paragraph: pIdx, sentence: sIdx },
          });
        }

        // Percentage patterns
        const percentMatches = sentence.matchAll(/(\d+\.?\d*)%/g);
        for (const match of percentMatches) {
          const value = parseFloat(match[1]);
          const context = this.extractMetricContext(sentence, match.index || 0);
          figures.push({
            value,
            unit: "percent",
            metricName: context,
            location: { paragraph: pIdx, sentence: sIdx },
          });
        }

        // Time patterns (months)
        const monthMatches = sentence.matchAll(/(\d+)\s*months?/gi);
        for (const match of monthMatches) {
          const value = parseInt(match[1], 10);
          const context = this.extractMetricContext(sentence, match.index || 0);
          figures.push({
            value,
            unit: "months",
            metricName: context.includes("payback") ? "payback_period" : context,
            location: { paragraph: pIdx, sentence: sIdx },
          });
        }
      }
    }

    return figures;
  }

  /**
   * Parse number from string (removes commas).
   */
  private parseNumber(str: string): number {
    return parseFloat(str.replace(/,/g, ""));
  }

  /**
   * Get multiplier for units (M, K, B).
   */
  private getMultiplier(unit?: string): number {
    if (!unit) return 1;
    const lower = unit.toLowerCase();
    if (lower === "m" || lower === "million") return 1_000_000;
    if (lower === "k" || lower === "thousand") return 1_000;
    if (lower === "b" || lower === "billion") return 1_000_000_000;
    return 1;
  }

  /**
   * Extract metric context from surrounding text.
   */
  private extractMetricContext(sentence: string, position: number): string {
    // Look for keywords before the number
    const before = sentence.slice(0, position).toLowerCase();
    const after = sentence.slice(position).toLowerCase();

    if (before.includes("roi") || after.includes("roi")) return "roi";
    if (before.includes("npv") || after.includes("npv")) return "npv";
    if (before.includes("payback") || after.includes("payback")) return "payback_period";
    if (before.includes("savings") || after.includes("savings")) return "cost_reduction";
    if (before.includes("revenue") || after.includes("revenue")) return "revenue_uplift";
    if (before.includes("efficiency") || after.includes("efficiency")) return "efficiency_gain";

    return "unspecified";
  }

  /**
   * Check if two metric names are related.
   */
  private isRelatedMetric(a: string, b: string): boolean {
    const relatedGroups = [
      ["roi", "return", "return on investment"],
      ["npv", "net present value"],
      ["payback", "payback period"],
      ["savings", "cost reduction"],
    ];

    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();

    for (const group of relatedGroups) {
      const aInGroup = group.some((g) => lowerA.includes(g));
      const bInGroup = group.some((g) => lowerB.includes(g));
      if (aInGroup && bInGroup) return true;
    }

    return false;
  }

  /**
   * Create a hallucination flag.
   */
  private createFlag(
    parsed: { value: number; unit: string; metricName: string; location: { paragraph: number; sentence: number } },
    expected: { value: number; unit: string; metricName: string; location: string } | null,
    severity: HallucinationSeverity,
    fullText: string,
  ): HallucinationFlag {
    const discrepancyPct = expected
      ? Math.abs(parsed.value - expected.value) / expected.value
      : 1;

    const paragraphs = fullText.split(/\n\n+/);
    const sentences = paragraphs[parsed.location.paragraph].split(/[.!?]+/);
    const claimText = sentences[parsed.location.sentence].trim();

    return {
      id: crypto.randomUUID(),
      severity,
      location: {
        section: "narrative",
        paragraph: parsed.location.paragraph,
        sentence: parsed.location.sentence,
      },
      claim: {
        text: claimText,
        figure: parsed.value,
        unit: parsed.unit,
        metric_name: parsed.metricName,
      },
      expected_value: expected?.value || 0,
      discrepancy_pct: Math.round(discrepancyPct * 10000) / 10000,
      source_calculation: expected?.location || "unknown",
      suggested_fix: expected
        ? `Replace "${parsed.value}" with "${expected.value}${expected.unit}"`
        : `Remove or verify unsupported claim: "${parsed.value}${parsed.unit}"`,
    };
  }
}
