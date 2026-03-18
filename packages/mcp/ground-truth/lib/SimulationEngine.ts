/**
 * Simulation Engine
 *
 * Models the combined impact of multiple business actions on SaaS KPIs.
 * Handles action interactions (synergies, diminishing returns) and
 * temporal effects (phased impact over time).
 */

import {
  ALL_BUSINESS_ACTIONS,
  BusinessAction,
  BusinessActionId,
  getBusinessAction,
  KPIImpact,
} from "../data/business-actions";
import { ESOPersona, ESOIndustry } from "@backend/types/eso";

/** Company size for context-aware simulation */
export type CompanySize = "startup" | "scaleup" | "enterprise";

/** Baseline KPI values for a company */
export interface CompanyBaseline {
  annualRevenue: number;
  kpis: Record<string, number>;
}

/** Simulation request parameters */
export interface SimulationRequest {
  actions: BusinessActionId[];
  baseline: CompanyBaseline;
  industry: ESOIndustry;
  companySize: CompanySize;
  persona: ESOPersona;
  /** Simulation period in days (default 365) */
  period?: number;
}

/** Impact on a single KPI from simulation */
export interface SimulatedKPIImpact {
  kpiId: string;
  baselineValue: number;
  projectedValue: number;
  absoluteChange: number;
  relativeChange: number;
  /** Contributing actions with their individual impacts */
  contributingActions: Array<{
    actionId: BusinessActionId;
    impact: number;
    confidence: number;
  }>;
  /** When impact starts and peaks */
  timeToInitialImpact: number;
  timeToPeakImpact: number;
  confidence: number;
}

/** Complete simulation result */
export interface SimulationResult {
  actions: BusinessActionId[];
  kpiImpacts: SimulatedKPIImpact[];
  /** Timeline of cumulative impacts */
  timeline: Array<{
    day: number;
    cumulativeImpact: number;
    activeActions: BusinessActionId[];
  }>;
  /** Overall confidence based on data quality */
  confidence: number;
  /** Implementation costs */
  totalImplementationCost: number;
  costRange: [number, number];
  /** Risk factors identified */
  riskFactors: string[];
  /** Key assumptions made */
  assumptions: string[];
}

/** Interaction between two actions */
interface ActionInteraction {
  type: "synergy" | "diminishing" | "independent";
  multiplier: number;
  reason: string;
}

/**
 * Calculate interaction effect between two actions
 */
function calculateActionInteraction(
  action1: BusinessAction,
  action2: BusinessAction
): ActionInteraction {
  // Same category actions often have diminishing returns
  if (action1.category === action2.category) {
    return {
      type: "diminishing",
      multiplier: 0.85,
      reason: `Both actions in ${action1.category} category - diminishing returns`,
    };
  }

  // Specific known synergies
  const synergyPairs: Array<[BusinessActionId, BusinessActionId, string]> = [
    [
      "implement_health_scoring",
      "increase_csm_ratio_2x",
      "Health scoring + more CSMs = better proactive intervention",
    ],
    [
      "improve_page_load_50pct",
      "add_self_service_onboarding",
      "Better performance improves self-service conversion",
    ],
    [
      "annual_commitment_discount",
      "implement_health_scoring",
      "Annual commits + health visibility = lower churn risk",
    ],
  ];

  for (const [id1, id2, reason] of synergyPairs) {
    if (
      (action1.id === id1 && action2.id === id2) ||
      (action1.id === id2 && action2.id === id1)
    ) {
      return { type: "synergy", multiplier: 1.15, reason };
    }
  }

  return { type: "independent", multiplier: 1.0, reason: "No significant interaction" };
}

/**
 * Apply time curve to impact based on action's time-to-impact
 */
function applyTimeCurve(
  fullImpact: number,
  timeToImpact: number,
  day: number
): number {
  if (day < timeToImpact * 0.3) {
    // Initial phase: minimal impact
    return fullImpact * 0.1 * (day / (timeToImpact * 0.3));
  } else if (day < timeToImpact) {
    // Ramp phase: building impact
    const rampProgress = (day - timeToImpact * 0.3) / (timeToImpact * 0.7);
    return fullImpact * (0.1 + 0.7 * rampProgress);
  } else if (day < timeToImpact * 2) {
    // Plateau phase: full impact
    return fullImpact;
  } else {
    // Mature phase: slight decay
    return fullImpact * 0.95;
  }
}

/**
 * Main simulation function
 */
export function simulateBusinessActions(
  request: SimulationRequest
): SimulationResult {
  const period = request.period || 365;
  const resolvedActions = request.actions
    .map((id) => getBusinessAction(id))
    .filter((a): a is BusinessAction => a !== undefined);

  // Collect all affected KPIs
  const affectedKPIs = new Map<string, KPIImpact[]>();
  for (const action of resolvedActions) {
    for (const impact of action.impacts) {
      const existing = affectedKPIs.get(impact.kpiId) || [];
      existing.push(impact);
      affectedKPIs.set(impact.kpiId, existing);
    }
  }

  // Calculate interaction matrix
  const interactionMultipliers = new Map<string, number>();
  for (let i = 0; i < resolvedActions.length; i++) {
    for (let j = i + 1; j < resolvedActions.length; j++) {
      const interaction = calculateActionInteraction(
        resolvedActions[i],
        resolvedActions[j]
      );
      const key = [resolvedActions[i].id, resolvedActions[j].id].sort().join("+");
      interactionMultipliers.set(key, interaction.multiplier);
    }
  }

  // Calculate combined multiplier for each action
  const getActionMultiplier = (action: BusinessAction): number => {
    let multiplier = 1.0;
    for (const other of resolvedActions) {
      if (other.id === action.id) continue;
      const key = [action.id, other.id].sort().join("+");
      const interactionMult = interactionMultipliers.get(key) || 1.0;
      multiplier *= interactionMult;
    }
    return Math.min(multiplier, 1.5); // Cap at 1.5x
  };

  // Simulate KPI impacts
  const kpiImpacts: SimulatedKPIImpact[] = [];
  for (const [kpiId, impacts] of affectedKPIs) {
    const baselineValue = request.baseline.kpis[kpiId] || 0;
    if (baselineValue === 0) continue;

    let totalImpact = 0;
    const contributingActions: SimulatedKPIImpact["contributingActions"] = [];
    let minTimeToImpact = Infinity;
    let maxTimeToPeak = 0;
    let totalConfidence = 0;

    for (const impact of impacts) {
      const action = resolvedActions.find((a) =>
        a.impacts.some((i) => i.kpiId === kpiId)
      );
      if (!action) continue;

      const multiplier = getActionMultiplier(action);
      const adjustedImpact = impact.medianImpact * multiplier;

      totalImpact += adjustedImpact;
      contributingActions.push({
        actionId: action.id,
        impact: adjustedImpact,
        confidence: impact.confidence,
      });

      minTimeToImpact = Math.min(minTimeToImpact, impact.timeToImpact);
      maxTimeToPeak = Math.max(maxTimeToPeak, impact.timeToImpact * 1.5);
      totalConfidence += impact.confidence;
    }

    const projectedValue = baselineValue * (1 + totalImpact);

    kpiImpacts.push({
      kpiId,
      baselineValue,
      projectedValue,
      absoluteChange: projectedValue - baselineValue,
      relativeChange: totalImpact,
      contributingActions,
      timeToInitialImpact: Math.round(minTimeToImpact * 0.3),
      timeToPeakImpact: Math.round(maxTimeToPeak),
      confidence:
        contributingActions.length > 0
          ? totalConfidence / contributingActions.length
          : 0,
    });
  }

  // Build timeline
  const timeline: SimulationResult["timeline"] = [];
  for (let day = 30; day <= period; day += 30) {
    let cumulativeImpact = 0;
    const activeActions: BusinessActionId[] = [];

    for (const action of resolvedActions) {
      let actionDayImpact = 0;
      for (const impact of action.impacts) {
        const fullImpact = impact.medianImpact * getActionMultiplier(action);
        actionDayImpact += applyTimeCurve(fullImpact, impact.timeToImpact, day);
      }
      cumulativeImpact += actionDayImpact;
      if (day >= action.impacts[0]?.timeToImpact * 0.3) {
        activeActions.push(action.id);
      }
    }

    timeline.push({
      day,
      cumulativeImpact: Math.round(cumulativeImpact * 100) / 100,
      activeActions: [...activeActions],
    });
  }

  // Calculate costs
  const costs = resolvedActions.map((a) => a.costRange);
  const totalImplementationCost = costs.reduce(
    (sum, range) => sum + (range[0] + range[1]) / 2,
    0
  );
  const costRange: [number, number] = [
    costs.reduce((sum, range) => sum + range[0], 0),
    costs.reduce((sum, range) => sum + range[1], 0),
  ];

  // Collect risk factors
  const riskFactors = new Set<string>();
  for (const action of resolvedActions) {
    for (const risk of action.risks) {
      riskFactors.add(risk);
    }
  }

  // Overall confidence
  const overallConfidence =
    kpiImpacts.length > 0
      ? kpiImpacts.reduce((sum, k) => sum + k.confidence, 0) / kpiImpacts.length
      : 0;

  return {
    actions: request.actions,
    kpiImpacts,
    timeline,
    confidence: Math.round(overallConfidence * 100) / 100,
    totalImplementationCost: Math.round(totalImplementationCost),
    costRange,
    riskFactors: Array.from(riskFactors),
    assumptions: [
      "Actions are implemented effectively",
      "Market conditions remain stable",
      "No major competitive disruptions",
      "Company has resources to execute",
    ],
  };
}

/**
 * Compare multiple scenarios side-by-side
 */
export interface ScenarioComparison {
  name: string;
  request: SimulationRequest;
  result: SimulationResult;
  score: number;
}

export function compareScenarios(
  scenarios: Array<{ name: string; request: SimulationRequest }>
): ScenarioComparison[] {
  const results = scenarios.map((s) => ({
    name: s.name,
    request: s.request,
    result: simulateBusinessActions(s.request),
    score: 0,
  }));

  // Score scenarios (higher is better)
  for (const r of results) {
    let score = 0;

    // Revenue impact
    const arrImpact = r.result.kpiImpacts.find((k) => k.kpiId === "saas_arr");
    if (arrImpact) {
      score += arrImpact.relativeChange * 100;
    }

    // Churn reduction
    const churnImpact = r.result.kpiImpacts.find((k) => k.kpiId === "saas_logo_churn");
    if (churnImpact && churnImpact.relativeChange < 0) {
      score += Math.abs(churnImpact.relativeChange) * 150;
    }

    // Confidence weighting
    score *= r.result.confidence;

    // Cost penalty (lower cost is better)
    const costPenalty = r.result.totalImplementationCost / 1000000;
    score -= costPenalty;

    r.score = Math.round(score * 10) / 10;
  }

  return results.sort((a, b) => b.score - a.score);
}
