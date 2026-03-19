/**
 * Ambient module declarations for stub packages.
 * These replace real packages that are not yet published.
 */

declare module '@valueos/templates' {
  export interface KPIImpact {
    id: string;
    name: string;
    value: number;
    baseline: number;
    change: number;
    changePercent: number;
    confidence: number;
    benchmark?: string;
    timeToImpact?: number;
    contributingActions?: string[];
    formulaDependencies?: string[];
    trend: 'up' | 'down';
    severity: 'high' | 'medium' | 'low';
  }

  export interface FinancialMetrics {
    roi: number;
    netPresentValue: number;
    internalRateOfReturn: number;
    benefitCostRatio: number;
    incrementalRevenue: number;
    costSavings: number;
    totalBenefits: number;
    totalCosts: number;
    paybackPeriod: number;
    sensitivity: {
      downside: number;
      baseCase: number;
      upside: number;
    };
    yearlyCashFlow: number[];
  }

  export interface CausalChain {
    driver: string;
    effect: string;
    impact: number;
    probability: number;
    confidence: number;
    timeToEffect: number;
    evidence: string[];
  }

  export interface AuditEvidence {
    step: string;
    timestamp: string;
    confidence: number;
    reasoning: string;
    sources: string[];
    hash: string;
    validation?: { valid: boolean };
    status: 'verified' | 'warning';
  }

  export interface TemplateDataSource {
    metrics: KPIImpact[];
    financials: FinancialMetrics;
    outcomes: CausalChain[];
    evidence: AuditEvidence[];
    context: Record<string, unknown>;
  }
}

declare module '@valueos/business-case' {
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
}
