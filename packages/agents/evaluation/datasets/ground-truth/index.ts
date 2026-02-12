/**
 * Ground Truth Datasets
 *
 * Complete value case scenarios with all artifacts needed to validate
 * the end-to-end HypothesisLoop pipeline. Each scenario includes:
 * - Hypotheses, evidence, value trees, narratives, objections
 * - Confidence scores and provenance records
 * - Expected saga state transitions
 */

export { saassDsoReductionScenario } from './saas-dso-reduction.js';
export { manufacturingYieldScenario } from './manufacturing-yield.js';
export { healthcareRevenueCycleScenario } from './healthcare-revenue-cycle.js';

import { saassDsoReductionScenario } from './saas-dso-reduction.js';
import { manufacturingYieldScenario } from './manufacturing-yield.js';
import { healthcareRevenueCycleScenario } from './healthcare-revenue-cycle.js';

/** All ground truth scenarios indexed by ID */
export const GROUND_TRUTH_SCENARIOS = {
  [saassDsoReductionScenario.meta.id]: saassDsoReductionScenario,
  [manufacturingYieldScenario.meta.id]: manufacturingYieldScenario,
  [healthcareRevenueCycleScenario.meta.id]: healthcareRevenueCycleScenario,
} as const;

export type GroundTruthScenarioId = keyof typeof GROUND_TRUTH_SCENARIOS;
