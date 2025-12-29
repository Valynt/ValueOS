/**
 * ValueOS Template Library - Phase 4 Implementation
 *
 * Complete UI template system for the Ground Truth Engine
 * All templates support trust badges, persona-aware rendering,
 * and full audit trail integration.
 */

// Atoms
export { KPICard } from "./atoms/KPICard";
export { TrustBadge } from "./atoms/TrustBadge";
export { ConfidenceBar } from "./atoms/ConfidenceBar";
export { TrustBadgeTooltip } from "./atoms/TrustBadgeTooltip";

// Molecules
export { FinancialSummary } from "./molecules/FinancialSummary";
export { CashFlowChart } from "./molecules/CashFlowChart";
export { RiskAnalysis } from "./molecules/RiskAnalysis";

// Organisms
export { TrinityDashboard } from "./organisms/TrinityDashboard";
export { ImpactCascadeTemplate } from "./organisms/ImpactCascadeTemplate";
export { ScenarioMatrix } from "./organisms/ScenarioMatrix";
export { StoryArcCanvas } from "./organisms/StoryArcCanvas";
export { QuantumView } from "./organisms/QuantumView";

// Hooks
export { useTemplateStore } from "./hooks/useTemplateStore";

// Types
export type {
  TemplateDataSource,
  FinancialMetrics,
  KPIImpact,
  CausalChain,
  AuditEvidence,
  TemplateContext,
  TrustBadgeProps,
} from "./types";

// Trinity Dashboard Types (New Truth Engine Integration)
export type {
  TrinityFinancials,
  TrinityVerification,
  TrinityOutcome,
} from "./trinity-adapter";

export { adaptToTrinityDashboard } from "./trinity-adapter";

// Utilities
export {
  formatNumber,
  formatActionName,
  formatKPIName,
  formatPersonaName,
  formatMetric,
} from "./utils/formatters";

/**
 * Template Registry
 * Maps template names to their components for dynamic rendering
 */
export const TemplateRegistry = {
  TrinityDashboard: () => import("./organisms/TrinityDashboard"),
  ImpactCascadeTemplate: () => import("./organisms/ImpactCascadeTemplate"),
  ScenarioMatrix: () => import("./organisms/ScenarioMatrix"),
  StoryArcCanvas: () => import("./organisms/StoryArcCanvas"),
  QuantumView: () => import("./organisms/QuantumView"),
} as const;

/**
 * Persona to Template Mapping
 * Automatically selects the best template for each persona
 */
export const PersonaTemplates: Record<string, string> = {
  cfo: "TrinityDashboard",
  director_finance: "TrinityDashboard",
  ctO: "ImpactCascadeTemplate",
  vp_product: "ImpactCascadeTemplate",
  vp_sales: "ScenarioMatrix",
  vp_ops: "StoryArcCanvas",
  ceo: "QuantumView",
  data_analyst: "QuantumView",
};

/**
 * Template Selection Helper
 * Selects the appropriate template based on persona and context
 */
export const selectTemplate = (
  persona: string,
  riskLevel?: string,
  confidence?: number
): string => {
  // High risk → Story Arc for narrative
  if (riskLevel === "high") return "StoryArcCanvas";

  // Low confidence → Quantum View for multiple perspectives
  if (confidence && confidence < 0.7) return "QuantumView";

  // Persona-based selection
  return PersonaTemplates[persona.toLowerCase()] || "TrinityDashboard";
};

/**
 * Template Data Adapter
 * Adapts Phase 3.5 BusinessCaseResult to template props
 */
export const adaptToTemplate = (
  businessCase: any,
  templateName: string
): any => {
  const adapters = {
    TrinityDashboard: {
      financials: {
        roi: businessCase.summary.roi,
        npv: businessCase.summary.netPresentValue,
        paybackPeriod: businessCase.summary.paybackPeriod,
        roiConfidence: businessCase.metadata.confidenceScore,
        npvConfidence: businessCase.metadata.confidenceScore,
        paybackConfidence: businessCase.metadata.confidenceScore,
        yearlyCashFlow: businessCase.financialImpact.yearlyCashFlow,
        sensitivity: businessCase.riskAnalysis,
      },
      trustBadges: businessCase.auditTrail.map((step: any) => ({
        metric: step.step,
        value: step.outputs[Object.keys(step.outputs)[0]],
        confidence: step.confidence,
        formula: step.inputs.formula || "N/A",
        hash: step.hash,
        sources: step.sources,
        reasoning: step.reasoning,
      })),
    },

    ImpactCascadeTemplate: {
      causalChains: businessCase.kpiImpacts.map((impact: any) => ({
        driver: impact.contributingActions[0] || "unknown",
        effect: impact.kpiId,
        impact: impact.change,
        probability: impact.confidence,
        confidence: impact.confidence,
        timeToEffect: impact.timeToImpact,
        evidence: businessCase.evidence.map((e: any) => e.source),
      })),
    },

    ScenarioMatrix: {
      scenarios: [
        {
          id: "downside",
          name: "Downside",
          financials: {
            roi: businessCase.riskAnalysis.downside.roi,
            npv: businessCase.riskAnalysis.downside.npv,
            paybackPeriod: businessCase.summary.paybackPeriod * 1.2,
          },
          riskLevel: "high",
          confidence: businessCase.metadata.confidenceScore * 0.8,
          actions: businessCase.recommendations
            .slice(0, 2)
            .map((r: any) => r.action),
        },
        {
          id: "base",
          name: "Base Case",
          financials: {
            roi: businessCase.summary.roi,
            npv: businessCase.summary.netPresentValue,
            paybackPeriod: businessCase.summary.paybackPeriod,
          },
          riskLevel: "medium",
          confidence: businessCase.metadata.confidenceScore,
          actions: businessCase.recommendations.map((r: any) => r.action),
        },
        {
          id: "upside",
          name: "Upside",
          financials: {
            roi: businessCase.riskAnalysis.upside.roi,
            npv: businessCase.riskAnalysis.upside.npv,
            paybackPeriod: businessCase.summary.paybackPeriod * 0.8,
          },
          riskLevel: "low",
          confidence: businessCase.metadata.confidenceScore * 0.9,
          actions: businessCase.recommendations
            .slice(0, 3)
            .map((r: any) => r.action),
        },
      ],
    },

    StoryArcCanvas: {
      timeline: businessCase.timeline.map((event: any, i: number) => ({
        id: `event-${i}`,
        day: event.day,
        action: event.action,
        impact: event.kpiImpacts.reduce(
          (sum: number, k: any) => sum + k.impact,
          0
        ),
        description: `Action ${event.action} leads to ${event.kpiImpacts.length} KPI changes`,
        confidence: event.confidence,
      })),
      title: businessCase.summary.title,
      subtitle: businessCase.summary.description,
    },

    QuantumView: {
      perspectives: ["cfo", "cto", "vp_sales"].map((persona) => ({
        persona,
        metrics: businessCase.kpiImpacts.slice(0, 3).map((k: any) => ({
          id: k.kpiId,
          name: k.kpiId.replace(/_/g, " ").toUpperCase(),
          value: k.projectedValue,
          unit: "$",
          trend: k.change > 0 ? "up" : "down",
        })),
        financials: {
          roi:
            businessCase.summary.roi *
            (persona === "cfo" ? 1 : persona === "cto" ? 0.9 : 1.1),
          npv:
            businessCase.summary.netPresentValue *
            (persona === "cfo" ? 1 : persona === "cto" ? 0.95 : 1.05),
          paybackPeriod: businessCase.summary.paybackPeriod,
        },
        confidence:
          businessCase.metadata.confidenceScore * (persona === "cfo" ? 1 : 0.9),
        summary:
          businessCase.summary.keyInsights[0] ||
          "Strategic value realization opportunity",
      })),
    },
  };

  return adapters[templateName as keyof typeof adapters] || {};
};

/**
 * Trust Badge Generator
 * Creates trust badges from audit trail entries
 */
export const generateTrustBadges = (auditTrail: any[]): any[] => {
  return auditTrail
    .filter((step) => step.confidence > 0.6)
    .map((step) => ({
      metric: step.step,
      value: step.outputs[Object.keys(step.outputs)[0]],
      confidence: step.confidence,
      formula: step.inputs.formula || "N/A",
      hash: step.hash,
      sources: step.sources,
      reasoning: step.reasoning,
    }));
};

/**
 * Export all components as default
 */
export default {
  KPICard,
  TrustBadge,
  ConfidenceBar,
  TrustBadgeTooltip,
  FinancialSummary,
  CashFlowChart,
  RiskAnalysis,
  TrinityDashboard,
  ImpactCascadeTemplate,
  ScenarioMatrix,
  StoryArcCanvas,
  QuantumView,
  useTemplateStore,
  TemplateRegistry,
  PersonaTemplates,
  selectTemplate,
  adaptToTemplate,
  generateTrustBadges,
};
