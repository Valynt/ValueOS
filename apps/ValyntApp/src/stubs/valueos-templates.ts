/**
 * Stub types for @valueos/templates.
 * Replace with the real package when the template library is published.
 */

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
