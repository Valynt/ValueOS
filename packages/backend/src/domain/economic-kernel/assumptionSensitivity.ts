/**
 * Assumption-level sensitivity analysis
 *
 * Identifies which assumptions have the highest impact on a business case
 * output (e.g. ROI, NPV). Operates on canonical Assumption domain objects
 * and uses the economic kernel's one-at-a-time sensitivity engine.
 *
 * Each assumption is perturbed across its sensitivity_range (or ±20% default)
 * while all others are held at their base value. Impact is measured as the
 * absolute swing in the output across the perturbation range.
 *
 * decimal.js is imported via a variable string to prevent Vite's static
 * analyser from attempting to resolve it at transform time in jsdom
 * environments (same constraint as FinancialModelingAgent).
 */

import type { Assumption } from "@valueos/shared/domain";

import { sensitivityAnalysis } from "./economic_kernel.js";
import type { SensitivityResult } from "./economic_kernel.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssumptionImpact {
  assumption_id: string;
  assumption_name: string;
  base_value: number;
  /** Absolute swing in output across the full perturbation range. */
  output_swing: number;
  /** output_swing / |base_output|, or null when base_output is zero. */
  relative_impact: number | null;
  sensitivity: SensitivityResult;
}

export interface AssumptionSensitivityResult {
  /** Assumptions ranked by output_swing descending. */
  ranked: AssumptionImpact[];
  /** The assumption with the highest impact on the output. */
  highest_impact: AssumptionImpact | null;
  base_output: number;
}

/** Default perturbation multipliers when no sensitivity_range is provided. */
const DEFAULT_PERTURBATION_VALUES = [0.8, 0.9, 1.0, 1.1, 1.2];

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Run one-at-a-time sensitivity analysis across a set of assumptions.
 *
 * @param assumptions - Canonical Assumption objects to analyse.
 * @param evaluate    - Pure function that maps a full set of assumption values
 *                      (keyed by assumption id) to a scalar output (e.g. ROI).
 *                      Must be deterministic.
 */
export async function analyseAssumptionSensitivity(
  assumptions: Assumption[],
  evaluate: (values: Record<string, number>) => number
): Promise<AssumptionSensitivityResult> {
  if (assumptions.length === 0) {
    return { ranked: [], highest_impact: null, base_output: 0 };
  }

  // Use a variable to prevent Vite's static analyser from resolving decimal.js
  // at transform time in jsdom environments (same pattern as FinancialModelingAgent).
  const decimalPkg = "decimal.js";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: Decimal } = await import(/* @vite-ignore */ decimalPkg) as { default: unknown };

  // Build base-case value map
  const baseValues: Record<string, number> = {};
  for (const a of assumptions) {
    baseValues[a.id] = a.value;
  }

  const baseOutput = evaluate(baseValues);
  const baseOutputDecimal = new (Decimal as new (n: number) => { isZero: () => boolean })(
    baseOutput
  );

  const impacts: AssumptionImpact[] = assumptions.map((assumption) => {
    // Derive perturbation multipliers from sensitivity_range if present
    let perturbations: (number | { toNumber: () => number })[];
    if (assumption.sensitivity_range) {
      const [low, high] = assumption.sensitivity_range;
      // Use 5 evenly-spaced points between low and high multipliers
      const step = (high - low) / 4;
      perturbations = Array.from({ length: 5 }, (_, i) => low + i * step);
    } else {
      perturbations = [...DEFAULT_PERTURBATION_VALUES];
    }

    const sensitivity = sensitivityAnalysis(
      assumption.name,
      new (Decimal as new (n: number) => { toNumber: () => number })(assumption.value),
      // Perturbations are numbers but sensitivityAnalysis expects decimals - cast accordingly
      perturbations.map((v) =>
        typeof v === "number"
          ? new (Decimal as new (n: number) => { toNumber: () => number })(v)
          : v
      ),
      (paramValue: { toNumber: () => number }) => {
        const values = { ...baseValues, [assumption.id]: paramValue.toNumber() };
        return new (Decimal as new (n: number) => { toNumber: () => number })(evaluate(values));
      }
    );

    const outputValues = sensitivity.points.map((p) => p.outputValue);
    const maxOutput = outputValues.reduce((m, v) => (v.gt(m) ? v : m), outputValues[0]);
    const minOutput = outputValues.reduce((m, v) => (v.lt(m) ? v : m), outputValues[0]);
    const swing = (maxOutput as { minus(other: unknown): { abs(): { toNumber(): number } } })
      .minus(minOutput)
      .abs()
      .toNumber();

    const relativeImpact = baseOutputDecimal.isZero()
      ? null
      : swing / Math.abs(baseOutput);

    return {
      assumption_id: assumption.id,
      assumption_name: assumption.name,
      base_value: assumption.value,
      output_swing: swing,
      relative_impact: relativeImpact,
      sensitivity,
    };
  });

  // Rank by output_swing descending
  const ranked = [...impacts].sort((a, b) => b.output_swing - a.output_swing);

  return {
    ranked,
    highest_impact: ranked[0] ?? null,
    base_output: baseOutput,
  };
}