/**
 * Financial Templates Index
 * 
 * Exports all 5 financial visualization templates for the Value Operating System:
 * 1. Impact Cascade - Value driver waterfall visualization
 * 2. Trinity Dashboard - 3-pillar ROI view (Revenue, Cost, Risk)
 * 3. Story Arc Canvas - Narrative progression visualization
 * 4. Scenario Matrix - What-if comparison views
 * 5. Quantum View - Multi-dimensional analysis
 */

export { ImpactCascadeTemplate } from './ImpactCascadeTemplate';
export { TrinityDashboard } from './TrinityDashboard';
export { StoryArcCanvas } from './StoryArcCanvas';
export { ScenarioMatrix } from './ScenarioMatrix';
export { QuantumView } from './QuantumView';

// Shared types for all templates
export interface TemplateDataSource {
  valueCaseId?: string;
  valueTreeId?: string;
  roiModelId?: string;
  metrics?: MetricData[];
  outcomes?: OutcomeData[];
  financials?: FinancialData;
}

export interface MetricData {
  id: string;
  name: string;
  value: number;
  unit: string;
  baseline?: number;
  target?: number;
  trend?: 'up' | 'down' | 'neutral';
  confidence?: 'high' | 'medium' | 'low';
}

export interface OutcomeData {
  id: string;
  name: string;
  description: string;
  category: 'revenue' | 'cost' | 'risk';
  impact: number;
  timeframe?: string;
  dependencies?: string[];
}

export interface FinancialData {
  totalValue: number;
  revenueImpact: number;
  costSavings: number;
  riskReduction: number;
  paybackPeriod?: string;
  roi?: number;
  npv?: number;
  irr?: number;
}

export interface TemplateProps {
  dataSource: TemplateDataSource;
  interactive?: boolean;
  onMetricClick?: (metric: MetricData) => void;
  onOutcomeClick?: (outcome: OutcomeData) => void;
  className?: string;
}
