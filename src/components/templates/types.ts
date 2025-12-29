/**
 * Template Library Types
 * 
 * Defines the data structures that Phase 4 templates expect
 * These are the "contract" that Phase 3.5 adapter fulfills
 */

/**
 * Core Template Data Source
 * All templates receive this unified structure
 */
export interface TemplateDataSource {
  /** KPI metrics from Structural Truth */
  metrics: KPIImpact[];
  
  /** Financial data from Business Case Generator */
  financials: FinancialMetrics;
  
  /** Causal chains from Causal Truth */
  outcomes: CausalChain[];
  
  /** Audit evidence from Audit Trail */
  evidence: AuditEvidence[];
  
  /** Context from Reasoning Engine */
  context: TemplateContext;
}

/**
 * KPI Impact for Metrics Grid
 */
export interface KPIImpact {
  id: string;
  name: string;
  value: number;
  baseline: number;
  change: number;
  changePercent: number;
  confidence: number;
  timeToImpact: number;
  contributingActions: string[];
  formulaDependencies: string[];
  
  /** Benchmark alignment */
  benchmark: {
    aligned: boolean;
    percentile: string;
    warning?: string;
  };
  
  /** Visual cues */
  trend: 'up' | 'down' | 'flat';
  severity: 'high' | 'medium' | 'low';
}

/**
 * Financial Metrics for Trinity Dashboard
 */
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
    downside: { npv: number; roi: number };
    baseCase: { npv: number; roi: number };
    upside: { npv: number; roi: number };
  };
  
  yearlyCashFlow: number[];
}

/**
 * Causal Chain for Impact Cascade
 */
export interface CausalChain {
  driver: string;      // Action that causes change
  effect: string;      // KPI that changes
  impact: number;      // Magnitude of change
  probability: number; // Likelihood
  confidence: number;  // Evidence quality
  timeToEffect: number; // Days until impact
  evidence: string[];  // Source references
}

/**
 * Audit Evidence for Trust Badges
 */
export interface AuditEvidence {
  step: string;
  timestamp: string;
  confidence: number;
  reasoning: string;
  sources: string[];
  hash: string;
  validation?: {
    valid: boolean;
    warnings: string[];
    errors: string[];
  };
  status: 'verified' | 'warning' | 'error';
}

/**
 * Template Context from Reasoning Engine
 */
export interface TemplateContext {
  persona: 'cfo' | 'cio' | 'cto' | 'coo' | 'vp_sales' | 'vp_ops' | 'vp_engineering' | 'director_finance' | 'data_analyst';
  industry: 'saas' | 'manufacturing' | 'healthcare' | 'finance' | 'retail' | 'technology' | 'professional_services';
  companySize: 'startup' | 'scaleup' | 'enterprise';
  timeframe: '30d' | '90d' | '180d' | '365d';
  confidenceScore: number;
  keyInsights: string[];
  recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
    effort: 'low' | 'medium' | 'high';
    quickWin: boolean;
  }>;
  riskLevel: 'low' | 'medium' | 'high';
  dataSources: string[];
}

/**
 * Trinity Dashboard Props
 */
export interface TrinityDashboardProps {
  financials: FinancialMetrics;
  riskAnalysis: {
    downside: { npv: number; roi: number; description: string };
    baseCase: { npv: number; roi: number; description: string };
    upside: { npv: number; roi: number; description: string };
  };
  context: TemplateContext;
  auditEvidence: AuditEvidence[];
}

/**
 * Impact Cascade Props
 */
export interface ImpactCascadeProps {
  causalChains: CausalChain[];
  metrics: KPIImpact[];
  context: TemplateContext;
  maxDepth?: number;
}

/**
 * Scenario Matrix Props
 */
export interface ScenarioMatrixProps {
  scenarios: Array<{
    name: string;
    financials: FinancialMetrics;
    riskLevel: 'low' | 'medium' | 'high';
    confidence: number;
  }>;
  context: TemplateContext;
  comparison: {
    bestROI: string;
    bestNPV: string;
    lowestRisk: string;
  };
}

/**
 * Story Arc Canvas Props
 */
export interface StoryArcCanvasProps {
  narrative: {
    problem: string;
    solution: string;
    outcome: string;
    risks: string[];
  };
  timeline: Array<{
    day: number;
    event: string;
    impact: number;
  }>;
  context: TemplateContext;
  auditTrail: AuditEvidence[];
}

/**
 * Quantum View Props
 */
export interface QuantumViewProps {
  perspectives: Array<{
    name: string;
    metrics: KPIImpact[];
    financials: FinancialMetrics;
    confidence: number;
  }>;
  context: TemplateContext;
  consensus: {
    bestAction: string;
    highestImpact: string;
    lowestRisk: string;
  };
}

/**
 * Trust Badge Props
 */
export interface TrustBadgeProps {
  metric: string;
  value: number;
  confidence: number;
  formula: string;
  hash: string;
  timestamp: string;
  sources: string[];
  reasoning: string;
}

/**
 * Template Registry
 * Maps template names to their props
 */
export interface TemplateRegistry {
  TrinityDashboard: TrinityDashboardProps;
  ImpactCascade: ImpactCascadeProps;
  ScenarioMatrix: ScenarioMatrixProps;
  StoryArcCanvas: StoryArcCanvasProps;
  QuantumView: QuantumViewProps;
}

/**
 * Template Selection Criteria
 */
export interface TemplateSelectionCriteria {
  persona?: string[];
  industry?: string[];
  riskLevel?: string[];
  confidenceThreshold?: number;
  preferredView?: string;
}

/**
 * Integration Result
 * What the Phase 3.5 adapter produces
 */
export interface IntegrationResult {
  templateName: string;
  templateData: TemplateDataSource;
  trustBadges: Array<{
    metric: string;
    badge: TrustBadgeProps | null;
  }>;
  metadata: {
    processedAt: string;
    engineVersion: string;
    templateVersion: string;
    integration: string;
  };
}