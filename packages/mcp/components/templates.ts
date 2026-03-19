/**
 * Financial template data types for CRM context injection.
 */

export interface MetricData {
  id: string;
  name: string;
  value: number;
  unit: string;
  category: string;
  confidence?: number;
  source?: string;
}

export interface OutcomeData {
  id: string;
  name: string;
  description?: string;
  category: string;
  status?: "achieved" | "on-track" | "in-progress" | "at-risk";
  metrics?: MetricData[];
}

export interface FinancialData {
  totalValue: number;
  revenueImpact: number;
  costSavings: number;
  riskReduction: number;
  currency: string;
  timeframe: string;
  confidence: number;
}

export interface TemplateDataSource {
  metrics: MetricData[];
  outcomes: OutcomeData[];
  financials: FinancialData;
}
