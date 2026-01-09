/**
 * Trinity Dashboard Types & Adapters
 * New Truth Engine-integrated interface
 */

import type {
  AuditEvidence,
  FinancialMetrics,
  TemplateDataSource,
} from "./types";

/**
 * Trinity Financial Data
 * Simplified financial structure for Trinity Dashboard
 */
export interface TrinityFinancials {
  totalValue: number;
  revenueImpact: number;
  costSavings: number;
  riskReduction: number;
  roi?: number;
  npv?: number;
  paybackPeriod?: string;
}

/**
 * Trinity Outcome
 * Individual outcome contributing to a pillar
 */
export interface TrinityOutcome {
  id: string;
  name: string;
  category: "revenue" | "cost" | "risk";
  impact: number;
  description?: string;
}

/**
 * Trinity Verification (Truth Engine Integration)
 */
export interface TrinityVerification {
  overall: { passed: boolean; confidence: number };
  revenue: { passed: boolean; confidence: number; citations: string[] };
  cost: { passed: boolean; confidence: number; citations: string[] };
  risk: { passed: boolean; confidence: number; citations: string[] };
}

/**
 * Adapter: Convert legacy TemplateDataSource → Trinity Types
 * Provides backward compatibility with existing systems
 */
export function adaptToTrinityDashboard(dataSource: TemplateDataSource): {
  financials: TrinityFinancials;
  verification: TrinityVerification;
  outcomes: TrinityOutcome[];
} {
  // Extract financials
  const financials: TrinityFinancials = {
    totalValue: dataSource.financials?.totalBenefits || 0,
    revenueImpact: dataSource.financials?.incrementalRevenue || 0,
    costSavings: dataSource.financials?.costSavings || 0,
    riskReduction: 0, // TODO: Calculate from risk analysis
    roi: dataSource.financials?.roi,
    npv: dataSource.financials?.netPresentValue,
    paybackPeriod: dataSource.financials?.paybackPeriod
      ? `${dataSource.financials.paybackPeriod} months`
      : undefined,
  };

  // Extract verification from audit evidence
  const overallConfidence = dataSource.context?.confidenceScore || 0;
  const auditByCategory = categorizeAuditEvidence(dataSource.evidence || []);

  const verification: TrinityVerification = {
    overall: {
      passed: overallConfidence >= 0.7,
      confidence: Math.round(overallConfidence * 100),
    },
    revenue: {
      passed: auditByCategory.revenue.confidence >= 0.7,
      confidence: Math.round(auditByCategory.revenue.confidence * 100),
      citations: auditByCategory.revenue.sources,
    },
    cost: {
      passed: auditByCategory.cost.confidence >= 0.7,
      confidence: Math.round(auditByCategory.cost.confidence * 100),
      citations: auditByCategory.cost.sources,
    },
    risk: {
      passed: auditByCategory.risk.confidence >= 0.7,
      confidence: Math.round(auditByCategory.risk.confidence * 100),
      citations: auditByCategory.risk.sources,
    },
  };

  // Extract outcomes from causal chains
  const outcomes: TrinityOutcome[] = (dataSource.outcomes || []).map(
    (chain, idx) => ({
      id: `outcome-${idx}`,
      name: chain.effect,
      category: categorizeOutcome(chain.effect),
      impact: chain.impact,
      description: chain.driver,
    })
  );

  return { financials, verification, outcomes };
}

/**
 * Helper: Categorize audit evidence by pillar
 */
function categorizeAuditEvidence(evidence: AuditEvidence[]): {
  revenue: { confidence: number; sources: string[] };
  cost: { confidence: number; sources: string[] };
  risk: { confidence: number; sources: string[] };
} {
  const categories = {
    revenue: { confidence: 0, sources: [] as string[] },
    cost: { confidence: 0, sources: [] as string[] },
    risk: { confidence: 0, sources: [] as string[] },
  };

  evidence.forEach((e) => {
    const step = e.step.toLowerCase();
    let category: "revenue" | "cost" | "risk" = "revenue";

    if (step.includes("cost") || step.includes("saving")) {
      category = "cost";
    } else if (step.includes("risk") || step.includes("compliance")) {
      category = "risk";
    }

    categories[category].confidence = Math.max(
      categories[category].confidence,
      e.confidence
    );
    categories[category].sources.push(...e.sources);
  });

  return categories;
}

/**
 * Helper: Categorize outcome by type
 */
function categorizeOutcome(effect: string): "revenue" | "cost" | "risk" {
  const lowerEffect = effect.toLowerCase();

  if (
    lowerEffect.includes("revenue") ||
    lowerEffect.includes("sales") ||
    lowerEffect.includes("customer")
  ) {
    return "revenue";
  }
  if (
    lowerEffect.includes("cost") ||
    lowerEffect.includes("saving") ||
    lowerEffect.includes("efficiency")
  ) {
    return "cost";
  }
  return "risk";
}
