/**
 * Stub type declarations for @valueos/business-case.
 * Replace with the real package when the business-case library is published.
 */

export interface KPIImpactDetail {
  kpiId: string;
  kpiName: string;
  projectedValue: number;
  baselineValue: number;
  absoluteChange: number;
  relativeChange: number;
  confidence: number;
  benchmarkAlignment?: string;
  timeToImpact?: number;
  contributingActions?: string[];
  formulaDependencies?: string[];
}

export interface FinancialImpact {
  netPresentValue: number;
  internalRateOfReturn: number;
  benefitCostRatio: number;
  incrementalRevenue: number;
  costSavings: number;
  totalBenefits: number;
  totalCosts: number;
  sensitivity: {
    downside: number;
    baseCase: number;
    upside: number;
  };
}

export interface TimelineEvent {
  action: string;
  day: number;
  probability: number;
  confidence: number;
  kpiImpacts: Array<{ kpiId: string; impact: number }>;
}

export interface AuditStep {
  step: string;
  timestamp: string;
  confidence: number;
  reasoning: string;
  sources: string[];
  hash?: string;
  inputs: { formula?: string; [key: string]: unknown };
  outputs: Record<string, { value?: unknown }>;
  validation?: { valid: boolean };
}

export interface Evidence {
  description: string;
  source: string;
}

export interface BusinessCaseSummary {
  paybackPeriod: number;
  keyInsights: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface BusinessCaseMetadata {
  persona: string;
  industry: string;
  companySize: string;
  timeframe: string;
  confidenceScore: number;
  dataSources: string[];
}

export interface BusinessCaseResult {
  kpiImpacts: KPIImpactDetail[];
  financialImpact: FinancialImpact;
  timeline: TimelineEvent[];
  auditTrail: AuditStep[];
  evidence: Evidence[];
  summary: BusinessCaseSummary;
  metadata: BusinessCaseMetadata;
  recommendations: string[];
}

/** @deprecated Use BusinessCaseResult */
export type BusinessCase = BusinessCaseResult;
