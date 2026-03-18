/**
 * Narrative Hallucination Checker Service
 *
 * Validates that financial figures in generated narratives match
 * deterministic calculations from the economic kernel.
 */

export type HallucinationSeverity = "minor" | "major" | "critical";
export type HallucinationType = "mismatch" | "fabricated" | "missing";

export interface ParsedFigure {
  raw: string;
  value: number;
  location: { start: number; end: number };
  type: string;
}

export interface CalculatedFigure {
  metric: string;
  value: number;
  required: boolean;
}

export interface HallucinationCheckInput {
  narrativeId: string;
  text: string;
  expectedFigures: CalculatedFigure[];
}

export interface Hallucination {
  type: HallucinationType;
  figure: string;
  location: { start: number; end: number };
  expected?: number;
  found?: number;
  severity: HallucinationSeverity;
  explanation: string;
}

export interface HallucinationResult {
  passed: boolean;
  hallucinations: Hallucination[];
  severity: "none" | "minor" | "major" | "critical";
}

/**
 * Parse financial figures from narrative text
 */
export function parseFinancialFigures(text: string): ParsedFigure[] {
  const figures: ParsedFigure[] = [];

  // Currency pattern: $1.2M, $500K, $10 million, $1.5 billion
  const currencyPattern = /\$([0-9]+\.?[0-9]*)\s?(M|K|million|billion)?/gi;
  let match;
  while ((match = currencyPattern.exec(text)) !== null) {
    figures.push({
      raw: match[0],
      value: normalizeValue(match[1], match[2]),
      location: { start: match.index, end: match.index + match[0].length },
      type: "currency",
    });
  }

  // Percentage pattern: 15%, 15 percent
  const percentPattern = /([0-9]+\.?[0-9]*)\s?(percent|%)/gi;
  while ((match = percentPattern.exec(text)) !== null) {
    figures.push({
      raw: match[0],
      value: parseFloat(match[1]) / 100,
      location: { start: match.index, end: match.index + match[0].length },
      type: "percentage",
    });
  }

  // Time periods: 3 years, 12 months
  const timePattern = /([0-9]+)\s?(years?|months?|quarters?)/gi;
  while ((match = timePattern.exec(text)) !== null) {
    figures.push({
      raw: match[0],
      value: parseInt(match[1], 10),
      location: { start: match.index, end: match.index + match[0].length },
      type: "time",
    });
  }

  return figures;
}

/**
 * Normalize value with unit suffix
 */
function normalizeValue(value: string, unit?: string): number {
  const num = parseFloat(value);
  if (!unit) return num;

  const lowerUnit = unit.toLowerCase();
  if (lowerUnit === "k") return num * 1000;
  if (lowerUnit === "m" || lowerUnit === "million") return num * 1000000;
  if (lowerUnit === "b" || lowerUnit === "billion") return num * 1000000000;

  return num;
}

/**
 * Cross-reference parsed figures against expected calculations
 */
export function crossReferenceFigures(
  parsed: ParsedFigure[],
  expected: CalculatedFigure[]
): Hallucination[] {
  const hallucinations: Hallucination[] = [];

  // Check for mismatches or fabricated figures
  for (const figure of parsed) {
    const match = expected.find(
      (e) =>
        e.metric === figure.type &&
        Math.abs(e.value - figure.value) < e.value * 0.01 // 1% tolerance
    );

    if (!match) {
      // Check if it's close to any expected figure (mismatch)
      const nearMatch = expected.find(
        (e) =>
          e.metric === figure.type &&
          Math.abs(e.value - figure.value) < e.value * 0.1 // 10% tolerance
      );

      if (nearMatch) {
        hallucinations.push({
          type: "mismatch",
          figure: figure.raw,
          location: figure.location,
          expected: nearMatch.value,
          found: figure.value,
          severity: classifySeverity(
            Math.abs(nearMatch.value - figure.value) / nearMatch.value
          ),
          explanation: `Expected ${nearMatch.value}, found ${figure.value}`,
        });
      } else {
        // No match at all - fabricated
        hallucinations.push({
          type: "fabricated",
          figure: figure.raw,
          location: figure.location,
          severity: "critical",
          explanation: "No matching calculation found",
        });
      }
    }
  }

  // Check for missing required figures
  for (const expectedFigure of expected) {
    if (!expectedFigure.required) continue;

    const found = parsed.find(
      (p) =>
        p.type === expectedFigure.metric &&
        Math.abs(p.value - expectedFigure.value) < expectedFigure.value * 0.01
    );

    if (!found) {
      hallucinations.push({
        type: "missing",
        figure: expectedFigure.metric,
        location: { start: 0, end: 0 },
        severity: "minor",
        explanation: `Expected figure ${expectedFigure.metric} not found in narrative`,
      });
    }
  }

  return hallucinations;
}

/**
 * Classify severity based on deviation percentage
 */
function classifySeverity(deviation: number): HallucinationSeverity {
  if (deviation < 0.1) return "minor";
  if (deviation < 0.5) return "major";
  return "critical";
}

/**
 * Check narrative for hallucinations
 */
export function checkHallucinations(
  input: HallucinationCheckInput
): HallucinationResult {
  const parsed = parseFinancialFigures(input.text);
  const hallucinations = crossReferenceFigures(
    parsed,
    input.expectedFigures
  );

  // Determine overall severity
  let severity: HallucinationResult["severity"] = "none";
  if (hallucinations.some((h) => h.severity === "critical")) {
    severity = "critical";
  } else if (hallucinations.some((h) => h.severity === "major")) {
    severity = "major";
  } else if (hallucinations.length > 0) {
    severity = "minor";
  }

  return {
    passed: severity !== "critical" && severity !== "major",
    hallucinations,
    severity,
  };
}

/**
 * NarrativeHallucinationChecker service class
 */
export class NarrativeHallucinationChecker {
  async check(input: HallucinationCheckInput): Promise<HallucinationResult> {
    return checkHallucinations(input);
  }
}

// Singleton instance
export const narrativeHallucinationChecker =
  new NarrativeHallucinationChecker();
