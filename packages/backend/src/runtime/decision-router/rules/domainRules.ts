/**
 * Domain-driven routing rules — Sprint 5
 *
 * Each rule is a pure function over DecisionContext. Rules are evaluated in
 * priority order by the DecisionRouter; the first match wins.
 *
 * Rule inventory:
 *   P10  generateBusinessCaseRule  — low value maturity → generate business case
 *   P20  gatherEvidenceRule        — hypothesis confidence < 0.4 → gather evidence
 *   P30  validateHypothesesRule    — hypotheses proposed but unreviewed → validate
 *   P40  mapStakeholdersRule       — no economic buyer mapped → map stakeholders
 *   P50  lifecycleStageRule        — lifecycle stage → canonical agent mapping
 */

import { DecisionContext } from '@shared/domain/DecisionContext';

import { RoutingRecommendation, RoutingRule } from './types.js';

// ---------------------------------------------------------------------------
// P10 — Generate business case when value maturity is low
// ---------------------------------------------------------------------------

/**
 * Fires when the opportunity's value maturity is 'low', indicating that the
 * value case has not been developed enough to present to a customer.
 * Recommends FinancialModelingAgent to generate a business case.
 *
 * Sprint 5.4 requirement: recommend `generateBusinessCase` if
 * `opportunity.valueMaturity === 'low'`.
 */
export const generateBusinessCaseRule: RoutingRule = {
  id: 'generate-business-case',
  priority: 10,
  description: "Recommend business case generation when opportunity value maturity is low",

  evaluate(context: DecisionContext): RoutingRecommendation | null {
    if (!context.opportunity) return null;
    if (context.opportunity.value_maturity !== 'low') return null;

    return {
      agent: 'financial-modeling',
      action: 'generateBusinessCase',
      reasoning: `Opportunity value maturity is 'low' — a business case must be generated before the engagement can progress.`,
      rule_priority: this.priority,
    };
  },
};

// ---------------------------------------------------------------------------
// P20 — Gather evidence when hypothesis confidence is too low
// ---------------------------------------------------------------------------

/**
 * Fires when the primary hypothesis has a confidence score below 0.4,
 * meaning the claim is not sufficiently grounded to include in a business case.
 * Recommends IntegrityAgent to gather supporting evidence.
 *
 * Sprint 5.4 requirement: recommend `gatherEvidence` if
 * `hypothesis.confidenceScore < 0.4`.
 */
export const gatherEvidenceRule: RoutingRule = {
  id: 'gather-evidence',
  priority: 20,
  description: "Recommend evidence gathering when hypothesis confidence score is below 0.4",

  evaluate(context: DecisionContext): RoutingRecommendation | null {
    if (!context.hypothesis) return null;

    // Use numeric score when available; fall back to enum mapping
    const score = context.hypothesis.confidence_score
      ?? confidenceEnumToScore(context.hypothesis.confidence);

    if (score >= 0.4) return null;

    return {
      agent: 'integrity',
      action: 'gatherEvidence',
      reasoning: `Hypothesis confidence score is ${score.toFixed(2)} (< 0.4) — evidence must be gathered before this claim can be used in a business case.`,
      rule_priority: this.priority,
    };
  },
};

// ---------------------------------------------------------------------------
// P30 — Validate hypotheses that are proposed but have no evidence
// ---------------------------------------------------------------------------

/**
 * Fires when the primary hypothesis is in 'proposed' status and has no
 * linked evidence. Recommends IntegrityAgent to validate the claim.
 */
export const validateHypothesesRule: RoutingRule = {
  id: 'validate-hypotheses',
  priority: 30,
  description: "Recommend hypothesis validation when proposed hypotheses have no evidence",

  evaluate(context: DecisionContext): RoutingRecommendation | null {
    if (!context.hypothesis) return null;
    if (context.hypothesis.evidence_count > 0) return null;

    // Score bands: P20 handles score < 0.4 (gatherEvidence); this rule handles
    // 0.4 ≤ score < 0.7 with no evidence. Score ≥ 0.7 with no evidence is
    // unusual enough to let the lifecycle stage rule decide.
    const score = context.hypothesis.confidence_score
      ?? confidenceEnumToScore(context.hypothesis.confidence);
    if (score >= 0.7) return null;

    return {
      agent: 'integrity',
      action: 'validateHypotheses',
      reasoning: `Hypothesis has no linked evidence and confidence score is ${score.toFixed(2)} — validation required before progressing.`,
      rule_priority: this.priority,
    };
  },
};

// ---------------------------------------------------------------------------
// P40 — Map stakeholders when economic buyer is missing
// ---------------------------------------------------------------------------

/**
 * Fires when the buying committee has no economic buyer identified.
 * Business cases presented without an economic buyer have low close rates.
 * Recommends OpportunityAgent to map stakeholders.
 */
export const mapStakeholdersRule: RoutingRule = {
  id: 'map-stakeholders',
  priority: 40,
  description: "Recommend stakeholder mapping when no economic buyer is identified",

  evaluate(context: DecisionContext): RoutingRecommendation | null {
    if (!context.buying_committee) return null;
    if (context.buying_committee.has_economic_buyer) return null;

    // Only fire when we're past discovery — in discovery it's expected
    if (context.opportunity?.lifecycle_stage === 'discovery') return null;

    return {
      agent: 'opportunity',
      action: 'mapStakeholders',
      reasoning: `No economic buyer is mapped for this opportunity — stakeholder mapping is required before the business case can be approved.`,
      rule_priority: this.priority,
    };
  },
};

// ---------------------------------------------------------------------------
// P50 — Lifecycle stage → canonical agent mapping
// ---------------------------------------------------------------------------

/**
 * Maps the canonical OpportunityLifecycleStage to the agent responsible for
 * that stage. This is the structured replacement for the legacy stage-based
 * switch in selectAgentForQuery().
 *
 * Fires last (lowest priority) so domain-state rules above can override it
 * when the opportunity needs remediation before progressing.
 */
export const lifecycleStageRule: RoutingRule = {
  id: 'lifecycle-stage',
  priority: 50,
  description: "Map lifecycle stage to the canonical agent for that stage",

  evaluate(context: DecisionContext): RoutingRecommendation | null {
    if (!context.opportunity) return null;

    const stage = context.opportunity.lifecycle_stage;

    switch (stage) {
      case 'discovery':
        return {
          agent: 'opportunity',
          action: 'generateHypotheses',
          reasoning: `Opportunity is in 'discovery' stage — OpportunityAgent generates initial value hypotheses.`,
          rule_priority: this.priority,
        };
      case 'drafting':
        return {
          agent: 'target',
          action: 'buildFinancialModel',
          reasoning: `Opportunity is in 'drafting' stage — TargetAgent sets KPI targets and builds the financial model.`,
          rule_priority: this.priority,
        };
      case 'validating':
        return {
          agent: 'integrity',
          action: 'validateHypotheses',
          reasoning: `Opportunity is in 'validating' stage — IntegrityAgent validates claims against evidence.`,
          rule_priority: this.priority,
        };
      case 'composing':
        return {
          agent: 'financial-modeling',
          action: 'generateBusinessCase',
          reasoning: `Opportunity is in 'composing' stage — FinancialModelingAgent assembles the business case.`,
          rule_priority: this.priority,
        };
      case 'refining':
        return {
          agent: 'integrity',
          action: 'validateHypotheses',
          reasoning: `Opportunity is in 'refining' stage — IntegrityAgent refines and re-validates claims.`,
          rule_priority: this.priority,
        };
      case 'realized':
        return {
          agent: 'realization',
          action: 'planRealization',
          reasoning: `Opportunity is in 'realized' stage — RealizationAgent tracks implementation milestones.`,
          rule_priority: this.priority,
        };
      case 'expansion':
        return {
          agent: 'expansion',
          action: 'identifyExpansion',
          reasoning: `Opportunity is in 'expansion' stage — ExpansionAgent identifies growth opportunities.`,
          rule_priority: this.priority,
        };
      default:
        return null;
    }
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps the HypothesisConfidence enum to a numeric score for rules that need
 * a threshold comparison. Uses midpoint values for each band.
 */
function confidenceEnumToScore(confidence: 'high' | 'medium' | 'low'): number {
  switch (confidence) {
    case 'high':   return 0.85;
    case 'medium': return 0.60;
    case 'low':    return 0.35;
  }
}

// ---------------------------------------------------------------------------
// Exported rule set (ordered by priority)
// ---------------------------------------------------------------------------

export const DOMAIN_ROUTING_RULES: RoutingRule[] = [
  generateBusinessCaseRule,
  gatherEvidenceRule,
  validateHypothesesRule,
  mapStakeholdersRule,
  lifecycleStageRule,
];
