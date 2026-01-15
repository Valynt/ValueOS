/**
 * Phase 3.5: Integration Adapter
 * 
 * Bridges the Ground Truth Engine (Phase 3) with the Template Library (Phase 4)
 * This is the critical "glue code" that makes templates display real, proven data
 * 
 * The Adapter Pattern: Converts BusinessCaseResult → TemplateDataSource
 */

import { BusinessCaseResult } from '../causal/business-case-generator-enhanced';
import { 
  TemplateDataSource,
  FinancialMetrics,
  KPIImpact,
  CausalChain,
  AuditEvidence 
} from '../components/templates/types';

/**
 * Main Adapter Function
 * 
 * Transforms the raw output from Phase 3 into the structured data format
 * expected by Phase 4 templates. This ensures every template displays
 * mathematically proven, audit-backed numbers.
 */
export function adaptBusinessCaseToTemplate(
  businessCase: BusinessCaseResult
): TemplateDataSource {
  return {
    // 1. Structural Truth → KPI Grid & Metrics
    // Maps the 200+ KPIs to visual metrics
    metrics: extractMetrics(businessCase),
    
    // 2. Business Case → Financial Dashboard
    // ROI, NPV, Cash Flow for Trinity Dashboard
    financials: extractFinancials(businessCase),
    
    // 3. Causal Truth → Impact Cascade
    // Shows how actions lead to outcomes
    outcomes: extractCausalChain(businessCase),
    
    // 4. Audit Trail → Trust Badge Data
    // Cryptographic proof for every number
    evidence: extractAuditEvidence(businessCase),
    
    // 5. Reasoning Engine → Context & Recommendations
    // Persona-aware insights
    context: extractContext(businessCase)
  };
}

/**
 * 1. STRUCTURAL TRUTH → METRICS
 * Extracts KPI impacts for grid visualization
 */
function extractMetrics(businessCase: BusinessCaseResult): KPIImpact[] {
  return businessCase.kpiImpacts.map(impact => ({
    id: impact.kpiId,
    name: impact.kpiName,
    value: impact.projectedValue,
    baseline: impact.baselineValue,
    change: impact.absoluteChange,
    changePercent: impact.relativeChange,
    confidence: impact.confidence,
    benchmark: impact.benchmarkAlignment,
    timeToImpact: impact.timeToImpact,
    contributingActions: impact.contributingActions,
    
    // Add formula dependency info for advanced users
    formulaDependencies: impact.formulaDependencies,
    
    // Visual cues for templates
    trend: impact.relativeChange > 0 ? 'up' : 'down',
    severity: getSeverity(impact.relativeChange, impact.confidence)
  }));
}

/**
 * 2. BUSINESS CASE → FINANCIALS
 * Extracts financial metrics for Trinity Dashboard
 */
function extractFinancials(businessCase: BusinessCaseResult): FinancialMetrics {
  const fi = businessCase.financialImpact;
  
  return {
    // Core metrics
    roi: fi.netPresentValue / fi.totalCosts,
    netPresentValue: fi.netPresentValue,
    internalRateOfReturn: fi.internalRateOfReturn,
    benefitCostRatio: fi.benefitCostRatio,
    
    // Cash flow breakdown
    incrementalRevenue: fi.incrementalRevenue,
    costSavings: fi.costSavings,
    totalBenefits: fi.totalBenefits,
    totalCosts: fi.totalCosts,
    
    // Payback period
    paybackPeriod: businessCase.summary.paybackPeriod,
    
    // Sensitivity analysis (for Trinity Dashboard)
    sensitivity: {
      downside: fi.sensitivity.downside,
      baseCase: fi.sensitivity.baseCase,
      upside: fi.sensitivity.upside
    },
    
    // Yearly cash flow projection (for trend visualization)
    yearlyCashFlow: generateCashFlowProjection(businessCase)
  };
}

/**
 * 3. CAUSAL TRUTH → OUTCOMES
 * Extracts causal chain for Impact Cascade
 */
function extractCausalChain(businessCase: BusinessCaseResult): CausalChain[] {
  // Map timeline events to causal chain
  const chainMap = new Map<string, CausalChain>();
  
  businessCase.timeline.forEach(event => {
    event.kpiImpacts.forEach(kpiImpact => {
      const key = `${event.action}-${kpiImpact.kpiId}`;
      
      if (!chainMap.has(key)) {
        chainMap.set(key, {
          driver: event.action,
          effect: kpiImpact.kpiId,
          impact: kpiImpact.impact,
          probability: event.probability,
          confidence: event.confidence,
          timeToEffect: event.day,
          evidence: getEvidenceForAction(event.action, kpiImpact.kpiId, businessCase)
        });
      }
    });
  });
  
  return Array.from(chainMap.values());
}

/**
 * 4. AUDIT TRUST → CRYPTOGRAPHIC PROOF
 * Extracts audit evidence for trust badges
 */
function extractAuditEvidence(businessCase: BusinessCaseResult): AuditEvidence[] {
  return businessCase.auditTrail
    .filter(step => step.confidence > 0.7) // Only high-confidence steps
    .map(step => ({
      step: step.step,
      timestamp: step.timestamp,
      confidence: step.confidence,
      reasoning: step.reasoning,
      sources: step.sources,
      hash: step.hash || 'N/A',
      
      // For tooltip display
      validation: step.validation,
      
      // Visual indicator
      status: step.validation?.valid ? 'verified' : 'warning'
    }));
}

/**
 * 5. REASONING ENGINE → CONTEXT
 * Extracts persona-aware context
 */
function extractContext(businessCase: BusinessCaseResult) {
  return {
    persona: businessCase.metadata.persona,
    industry: businessCase.metadata.industry,
    companySize: businessCase.metadata.companySize,
    timeframe: businessCase.metadata.timeframe,
    confidenceScore: businessCase.metadata.confidenceScore,
    
    // Key insights for summary cards
    keyInsights: businessCase.summary.keyInsights,
    
    // Recommendations for action cards
    recommendations: businessCase.recommendations,
    
    // Risk level for warning indicators
    riskLevel: businessCase.summary.riskLevel,
    
    // Data sources for transparency
    dataSources: businessCase.metadata.dataSources
  };
}

/**
 * INTELLIGENT TEMPLATE SELECTION
 * Uses Reasoning Engine to prescribe the right template
 */
export function selectTemplateByContext(
  context: ReturnType<typeof extractContext>
): string {
  const { persona, riskLevel, confidenceScore } = context;
  
  // CFO: Always wants Trinity Dashboard (Risk/Cash Flow/ROI)
  if (persona === 'cfo' || persona === 'director_finance') {
    return 'TrinityDashboard';
  }
  
  // Product Manager: Wants Impact Cascade (Features → Outcomes)
  if (persona === 'vp_product' || persona === 'cto') {
    return 'ImpactCascadeTemplate';
  }
  
  // VP Sales: Wants Scenario Matrix (Compare strategies)
  if (persona === 'vp_sales') {
    return 'ScenarioMatrix';
  }
  
  // High risk: Show Story Arc (Narrative of risks)
  if (riskLevel === 'high') {
    return 'StoryArcCanvas';
  }
  
  // Low confidence: Show Quantum View (Multiple perspectives)
  if (confidenceScore < 0.7) {
    return 'QuantumView';
  }
  
  // Default: Trinity Dashboard
  return 'TrinityDashboard';
}

/**
 * VISUAL TRUST BADGE GENERATOR
 * Creates tooltip data for audit overlay
 */
export function generateTrustBadge(
  metricName: string,
  businessCase: BusinessCaseResult
) {
  const relevantSteps = businessCase.auditTrail.filter(step =>
    JSON.stringify(step.outputs).toLowerCase().includes(metricName.toLowerCase())
  );
  
  if (relevantSteps.length === 0) {
    return null;
  }
  
  const latestStep = relevantSteps[relevantSteps.length - 1];
  
  return {
    metric: metricName,
    value: latestStep.outputs[metricName]?.value || 'Derived',
    confidence: latestStep.confidence,
    formula: latestStep.inputs.formula || 'N/A',
    hash: latestStep.hash,
    timestamp: latestStep.timestamp,
    sources: latestStep.sources,
    reasoning: latestStep.reasoning
  };
}

/**
 * HELPER: Calculate severity for visual cues
 */
function getSeverity(changePercent: number, confidence: number): 'high' | 'medium' | 'low' {
  if (Math.abs(changePercent) > 20 && confidence > 0.8) return 'high';
  if (Math.abs(changePercent) > 10 && confidence > 0.6) return 'medium';
  return 'low';
}

/**
 * HELPER: Generate cash flow projection
 */
function generateCashFlowProjection(businessCase: BusinessCaseResult): number[] {
  // Simplified projection based on timeline
  const projection: number[] = [];
  const yearlyTotal = businessCase.financialImpact.totalBenefits / 3; // 3 year projection
  
  for (let i = 1; i <= 3; i++) {
    // Ramp up over time
    const ramp = i === 1 ? 0.3 : i === 2 ? 0.6 : 1.0;
    projection.push(yearlyTotal * ramp);
  }
  
  return projection;
}

/**
 * HELPER: Get evidence for specific action-kpi pair
 */
function getEvidenceForAction(action: string, kpi: string, businessCase: BusinessCaseResult): string[] {
  const evidence = businessCase.evidence.find(e =>
    e.description.includes(action) && e.description.includes(kpi)
  );
  
  return evidence ? [evidence.source] : [];
}

/**
 * PHASE 3.5 INTEGRATION MANAGER
 * Orchestrates the complete data flow from Engine to Templates
 */
export class IntegrationManager {
  private adapter: typeof adaptBusinessCaseToTemplate;
  private templateSelector: typeof selectTemplateByContext;
  private trustBadgeGenerator: typeof generateTrustBadge;
  
  constructor() {
    this.adapter = adaptBusinessCaseToTemplate;
    this.templateSelector = selectTemplateByContext;
    this.trustBadgeGenerator = generateTrustBadge;
  }
  
  /**
   * Complete pipeline: Business Case → Template Data
   */
  async processBusinessCase(businessCase: BusinessCaseResult) {
    // 1. Adapt data
    const templateData = this.adapter(businessCase);
    
    // 2. Select appropriate template
    const templateName = this.templateSelector(templateData.context);
    
    // 3. Generate trust badges for all metrics
    const trustBadges = templateData.metrics.map(metric => ({
      metric: metric.name,
      badge: this.trustBadgeGenerator(metric.name, businessCase)
    }));
    
    return {
      templateName,
      templateData,
      trustBadges,
      metadata: {
        processedAt: new Date().toISOString(),
        engineVersion: '3.0',
        templateVersion: '4.0',
        integration: 'Phase 3.5'
      }
    };
  }
  
  /**
   * Real-time template switching based on persona changes
   */
  async switchTemplate(
    newPersona: string,
    currentData: TemplateDataSource
  ): Promise<string> {
    const context = { ...currentData.context, persona: newPersona as any };
    return this.templateSelector(context);
  }
  
  /**
   * Add trust overlay to existing template data
   */
  async addTrustOverlay(
    templateData: TemplateDataSource,
    businessCase: BusinessCaseResult
  ): Promise<TemplateDataSource & { trustOverlay: any[] }> {
    const trustOverlay = templateData.metrics.map(metric => ({
      metric: metric.name,
      value: metric.value,
      trust: this.trustBadgeGenerator(metric.name, businessCase)
    }));
    
    return { ...templateData, trustOverlay };
  }
}

/**
 * USAGE EXAMPLE:
 * 
 * const manager = new IntegrationManager();
 * 
 * // Generate business case
 * const businessCase = await businessCaseGenerator.generateBusinessCase(request);
 * 
 * // Process for templates
 * const result = await manager.processBusinessCase(businessCase);
 * 
 * // Render template
 * renderTemplate(result.templateName, result.templateData);
 * 
 * // Show trust badges on hover
 * showTrustBadges(result.trustBadges);
 */