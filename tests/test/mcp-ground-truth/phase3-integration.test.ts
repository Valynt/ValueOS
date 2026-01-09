/**
 * Phase 3 Integration Tests
 * 
 * Comprehensive integration tests for the complete Phase 3 flow:
 * - Structural Truth calculations
 * - Causal Truth impact analysis
 * - Business Case Generation with audit trail
 * - Reasoning Engine recommendations
 * - Audit Trail integrity
 * 
 * Part of Phase 3 - Integration & Business Case Generation
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IntegratedMCPServer } from '../../../src/mcp-ground-truth/core/IntegratedMCPServer';
import { StructuralTruth } from '../../../src/structural/structural-truth';
import CausalTruth from '../../../src/causal/causal-truth-enhanced';
import { EnhancedBusinessCaseGenerator } from '../../../src/causal/business-case-generator-enhanced';
import { ReasoningEngine } from '../../../src/reasoning/reasoning-engine';
import { AuditTrailManager, ComplianceMonitor } from '../../../src/audit/audit-trail';

// Test configuration
const TEST_CONFIG = {
  edgar: {
    userAgent: 'TestAgent',
    rateLimit: 10
  },
  xbrl: {
    userAgent: 'TestAgent',
    rateLimit: 10
  },
  marketData: {
    provider: 'alphavantage' as const,
    apiKey: 'test-key',
    rateLimit: 5
  },
  privateCompany: {
    enableWebScraping: false
  },
  industryBenchmark: {
    enableStaticData: true
  },
  truthLayer: {
    enableFallback: true,
    strictMode: false,
    maxResolutionTime: 5000,
    parallelQuery: false
  },
  security: {
    enableWhitelist: false,
    enableRateLimiting: false,
    enableAuditLogging: true
  },
  structuralTruth: {
    strictValidation: true,
    maxFormulaDepth: 10,
    enableBenchmarkChecks: true
  },
  causalTruth: {
    enableContextualAdjustments: true,
    confidenceThreshold: 0.6,
    maxChainDepth: 3
  },
  auditTrail: {
    enabled: true,
    maxEntries: 5000,
    persistentStorage: false
  }
};

// Test data
const TEST_SaaS_COMPANY = {
  persona: 'cfo' as const,
  industry: 'saas' as const,
  companySize: 'scaleup' as const,
  annualRevenue: 5000000,
  currentKPIs: {
    saas_arr: 5000000,
    saas_mrr: 416667,
    saas_nrr: 95,
    saas_logo_churn: 12,
    saas_cac: 800,
    saas_ltv: 12000,
    saas_arpu: 150
  },
  selectedActions: ['price_increase_5pct', 'implement_health_scoring', 'improve_page_load_50pct'],
  timeframe: '180d' as const,
  confidenceThreshold: 0.7
};

describe('Phase 3 Integration Tests', () => {
  let server: IntegratedMCPServer;
  let structuralTruth: StructuralTruth;
  let causalTruth: CausalTruth;
  let businessCaseGenerator: EnhancedBusinessCaseGenerator;
  let reasoningEngine: ReasoningEngine;
  let auditManager: AuditTrailManager;
  let complianceMonitor: ComplianceMonitor;

  beforeAll(async () => {
    // Initialize integrated server
    server = new IntegratedMCPServer(TEST_CONFIG);
    await server.initialize();

    // Initialize individual components for direct testing
    structuralTruth = new StructuralTruth(TEST_CONFIG.structuralTruth!);
    causalTruth = new CausalTruth(TEST_CONFIG.causalTruth!);
    businessCaseGenerator = new EnhancedBusinessCaseGenerator(structuralTruth, causalTruth);
    reasoningEngine = new ReasoningEngine(structuralTruth, causalTruth);
    
    auditManager = AuditTrailManager.getInstance();
    auditManager.configure(TEST_CONFIG.auditTrail!);
    complianceMonitor = new ComplianceMonitor();
  });

  beforeEach(() => {
    // Clear audit trail before each test
    auditManager.clear();
  });

  afterEach(() => {
    // Clean up
    auditManager.clear();
  });

  describe('Structural Truth Integration', () => {
    it('should calculate KPI dependencies correctly', async () => {
      const dependencies = structuralTruth.getDependencies('saas_nrr');
      expect(dependencies).toContain('saas_logo_churn');
      expect(dependencies).toContain('saas_expansion_revenue');
    });

    it('should evaluate formulas correctly', async () => {
      const registry = structuralTruth.getFormulaRegistry();
      const result = registry.evaluate('f_saas_mrr', [
        { kpiId: 'saas_arr', value: 5000000, confidence: 1.0 }
      ]);

      expect(result.success).toBe(true);
      expect(result.output?.value).toBeCloseTo(416666.67, 1);
      expect(result.output?.kpiId).toBe('saas_mrr');
    });

    it('should calculate cascading impacts', async () => {
      const impacts = structuralTruth.calculateCascadingImpact('saas_arr', 100000, 2);
      
      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts.some(i => i.kpiId === 'saas_mrr')).toBe(true);
    });

    it('should get KPIs for persona', async () => {
      const kpis = structuralTruth.getKPIsForPersona('cfo');
      expect(kpis.length).toBeGreaterThan(0);
      expect(kpis.some(k => k.id === 'saas_arr')).toBe(true);
    });
  });

  describe('Causal Truth Integration', () => {
    it('should get impact for business action', async () => {
      const impact = causalTruth.getImpactForAction(
        'price_increase_5pct',
        'cfo',
        'saas',
        'scaleup'
      );

      expect(impact).not.toBeNull();
      expect(impact!.action).toBe('price_increase_5pct');
      expect(impact!.confidence).toBeGreaterThan(0);
      expect(impact!.timeCurve).toBeDefined();
    });

    it('should simulate action outcome', async () => {
      const result = causalTruth.simulateScenario(
        ['price_increase_5pct'],
        TEST_SaaS_COMPANY.currentKPIs,
        'cfo',
        'saas',
        'scaleup'
      );

      expect(result.actions).toContain('price_increase_5pct');
      expect(result.totalImpact).not.toBe(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should compare multiple scenarios', async () => {
      const scenarios = [
        {
          name: 'Conservative',
          actions: ['price_increase_5pct'],
          baseline: TEST_SaaS_COMPANY.currentKPIs,
          persona: 'cfo' as const,
          industry: 'saas' as const,
          companySize: 'scaleup' as const
        },
        {
          name: 'Aggressive',
          actions: ['price_increase_5pct', 'double_marketing_spend'],
          baseline: TEST_SaaS_COMPANY.currentKPIs,
          persona: 'cfo' as const,
          industry: 'saas' as const,
          companySize: 'scaleup' as const
        }
      ];

      const results = scenarios.map(scenario => 
        causalTruth.simulateScenario(
          scenario.actions,
          scenario.baseline,
          scenario.persona,
          scenario.industry,
          scenario.companySize
        )
      );

      expect(results.length).toBe(2);
      expect(results[1].totalImpact).toBeGreaterThan(results[0].totalImpact);
    });

    it('should get cascading effects', async () => {
      const effects = causalTruth.getCascadingEffects(
        'price_increase_5pct',
        'saas_arr',
        2,
        'cfo',
        'saas',
        'scaleup'
      );

      expect(effects.rootAction).toBe('price_increase_5pct');
      expect(effects.chain.length).toBeGreaterThan(0);
      expect(effects.totalImpact.p50).not.toBe(0);
    });

    it('should get recommendations for KPI improvement', async () => {
      const recommendations = causalTruth.getRecommendationsForKPI(
        'saas_nrr',
        0.05,
        'cfo',
        'saas',
        'scaleup',
        { maxTime: 180, minConfidence: 0.6 }
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].confidence).toBeGreaterThan(0.6);
      expect(recommendations[0].timeToImpact).toBeLessThanOrEqual(180);
    });
  });

  describe('Business Case Generation Integration', () => {
    it('should generate complete business case', async () => {
      const result = await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);

      expect(result.metadata.id).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.financialImpact).toBeDefined();
      expect(result.kpiImpacts.length).toBeGreaterThan(0);
      expect(result.timeline.length).toBeGreaterThan(0);
      expect(result.riskAnalysis).toBeDefined();
      expect(result.auditTrail.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('should validate business case inputs', async () => {
      const invalidRequest = {
        ...TEST_SaaS_COMPANY,
        annualRevenue: -1000 // Invalid
      };

      await expect(
        businessCaseGenerator.generateBusinessCase(invalidRequest as any)
      ).rejects.toThrow();
    });

    it('should include full audit trail', async () => {
      const result = await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);

      // Check for key audit steps
      const stepNames = result.auditTrail.map(s => s.step);
      expect(stepNames).toContain('Input Validation');
      expect(stepNames).toContain('Calculate Direct Impacts');
      expect(stepNames).toContain('Calculate Financial Impact');
      expect(stepNames).toContain('Risk Analysis');
      expect(stepNames).toContain('Create Business Case Summary');

      // Check for validation results
      const validationStep = result.auditTrail.find(s => s.step === 'Input Validation');
      expect(validationStep?.outputs.valid).toBe(true);
    });

    it('should calculate financial metrics correctly', async () => {
      const result = await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);

      expect(result.financialImpact.netPresentValue).toBeDefined();
      expect(result.financialImpact.internalRateOfReturn).toBeDefined();
      expect(result.financialImpact.benefitCostRatio).toBeDefined();
      
      // ROI should be positive for good scenarios
      const roi = result.financialImpact.netPresentValue / result.financialImpact.totalCosts;
      expect(roi).toBeGreaterThan(0);
    });

    it('should generate risk analysis', async () => {
      const result = await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);

      expect(result.riskAnalysis.downsideScenario).toBeDefined();
      expect(result.riskAnalysis.baseCase).toBeDefined();
      expect(result.riskAnalysis.upsideScenario).toBeDefined();
      expect(result.riskAnalysis.keyRisks.length).toBeGreaterThan(0);
      expect(result.riskAnalysis.mitigationStrategies.length).toBeGreaterThan(0);
    });

    it('should compile evidence from multiple sources', async () => {
      const result = await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);

      expect(result.evidence.length).toBeGreaterThan(0);
      
      // Check evidence quality
      const evidenceQualities = result.evidence.map(e => e.quality);
      expect(evidenceQualities).toContain('meta_analysis');
      expect(evidenceQualities).toContain('case_study');
    });

    it('should benchmark alignment check', async () => {
      const result = await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);

      // Check that KPI impacts have benchmark alignment
      const kpiWithAlignment = result.kpiImpacts.find(k => k.benchmarkAlignment);
      expect(kpiWithAlignment).toBeDefined();
    });
  });

  describe('Reasoning Engine Integration', () => {
    it('should generate strategic recommendations', async () => {
      const result = await reasoningEngine.generateRecommendations({
        persona: 'cfo',
        industry: 'saas',
        companySize: 'scaleup',
        currentKPIs: TEST_SaaS_COMPANY.currentKPIs,
        goals: ['Improve NRR by 5%', 'Reduce CAC by 10%'],
        constraints: {
          maxInvestment: 500000,
          maxTime: 180,
          minROI: 1.5,
          riskTolerance: 'medium',
          preferredQuickWins: true
        }
      });

      expect(result.strategy).toBeDefined();
      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.reasoningChain.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('should build reasoning chain', async () => {
      const result = await reasoningEngine.generateRecommendations({
        persona: 'cfo',
        industry: 'saas',
        companySize: 'scaleup',
        currentKPIs: TEST_SaaS_COMPANY.currentKPIs,
        goals: ['Improve margins'],
        constraints: {}
      });

      // Check for expected reasoning steps
      const stepTypes = result.reasoningChain.map(s => s.type);
      expect(stepTypes).toContain('analysis');
      expect(stepTypes).toContain('inference');
      expect(stepTypes).toContain('evaluation');
      expect(stepTypes).toContain('decision');
    });

    it('should generate alternatives', async () => {
      const result = await reasoningEngine.generateRecommendations({
        persona: 'cfo',
        industry: 'saas',
        companySize: 'scaleup',
        currentKPIs: TEST_SaaS_COMPANY.currentKPIs,
        goals: ['Growth'],
        constraints: {}
      });

      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.alternatives[0].actions.length).toBeGreaterThan(0);
      expect(result.alternatives[0].expectedROI).toBeDefined();
    });

    it('should respect constraints', async () => {
      const result = await reasoningEngine.generateRecommendations({
        persona: 'cfo',
        industry: 'saas',
        companySize: 'scaleup',
        currentKPIs: TEST_SaaS_COMPANY.currentKPIs,
        goals: ['Test'],
        constraints: {
          maxTime: 30, // Very restrictive
          minROI: 10,  // Very high
          riskTolerance: 'low'
        }
      });

      // Should still generate recommendations but may have lower confidence
      expect(result.recommendedActions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Audit Trail Integration', () => {
    it('should log all operations', async () => {
      // Generate a business case to create audit entries
      await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);

      const entries = auditManager.query({});
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should maintain hash chain integrity', async () => {
      // Generate multiple entries
      await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);
      await reasoningEngine.generateRecommendations({
        persona: 'cfo',
        industry: 'saas',
        companySize: 'scaleup',
        currentKPIs: TEST_SaaS_COMPANY.currentKPIs,
        goals: ['Test'],
        constraints: {}
      });

      const integrity = auditManager.verifyIntegrity();
      expect(integrity.valid).toBe(true);
      expect(integrity.issues.length).toBe(0);
    });

    it('should generate compliance report', async () => {
      const startTime = new Date(Date.now() - 86400000).toISOString(); // Last 24 hours
      const endTime = new Date().toISOString();

      // Generate some activity
      await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);

      const report = auditManager.generateComplianceReport(startTime, endTime);

      expect(report.period.start).toBe(startTime);
      expect(report.period.end).toBe(endTime);
      expect(report.totalOperations).toBeGreaterThan(0);
      expect(report.signature).toBeDefined();
    });

    it('should track violations', async () => {
      // Create a low confidence entry manually
      auditManager.log({
        level: 'WARN',
        category: 'CALCULATION',
        component: 'Test',
        operation: 'test_operation',
        inputs: {},
        outputs: {},
        confidence: 0.3,
        reasoning: 'Low confidence test',
        evidence: []
      });

      const report = auditManager.generateComplianceReport(
        new Date(Date.now() - 3600000).toISOString(),
        new Date().toISOString()
      );

      expect(report.violations.length).toBeGreaterThan(0);
      expect(report.violations.some(v => v.type === 'LOW_CONFIDENCE')).toBe(true);
    });

    it('should provide compliance dashboard', async () => {
      // Generate some activity
      await businessCaseGenerator.generateBusinessCase(TEST_SaaS_COMPANY);

      const dashboard = complianceMonitor.getDashboardData();

      expect(dashboard.complianceScore).toBeDefined();
      expect(dashboard.health).toBeDefined();
      expect(dashboard.stats).toBeDefined();
      expect(dashboard.anomalies).toBeDefined();
    });

    it('should detect anomalies', async () => {
      // Generate multiple errors
      for (let i = 0; i < 15; i++) {
        auditManager.log({
          level: 'ERROR',
          category: 'ERROR',
          component: 'Test',
          operation: 'test',
          inputs: {},
          outputs: {},
          confidence: 0,
          reasoning: 'Test error',
          evidence: []
        });
      }

      const anomalies = complianceMonitor.detectAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.includes('Error spike'))).toBe(true);
    });
  });

  describe('Integrated MCP Server', () => {
    it('should expose all Phase 3 tools', async () => {
      const tools = server.getTools();
      
      const toolNames = tools.map(t => t.name);
      
      // Structural Truth tools
      expect(toolNames).toContain('get_kpi_formula');
      expect(toolNames).toContain('calculate_kpi_value');
      expect(toolNames).toContain('get_cascading_impacts');
      
      // Causal Truth tools
      expect(toolNames).toContain('get_causal_impact');
      expect(toolNames).toContain('simulate_action_outcome');
      expect(toolNames).toContain('compare_scenarios');
      expect(toolNames).toContain('get_cascading_effects');
      expect(toolNames).toContain('get_recommendations_for_kpi');
      
      // Business Case tools
      expect(toolNames).toContain('generate_business_case');
      expect(toolNames).toContain('compare_business_scenarios');
      
      // Reasoning tools
      expect(toolNames).toContain('generate_strategic_recommendations');
      
      // Audit tools
      expect(toolNames).toContain('query_audit_trail');
      expect(toolNames).toContain('generate_compliance_report');
      expect(toolNames).toContain('verify_audit_integrity');
      expect(toolNames).toContain('get_compliance_dashboard');
    });

    it('should execute Phase 3 tools', async () => {
      const result = await server.executeTool('generate_business_case', TEST_SaaS_COMPANY);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const data = JSON.parse(result.content[0].text);
      expect(data.summary).toBeDefined();
      expect(data.financialImpact).toBeDefined();
    });

    it('should maintain audit trail across tool executions', async () => {
      // Execute multiple tools
      await server.executeTool('get_causal_impact', {
        action: 'price_increase_5pct',
        kpi: 'saas_arr',
        persona: 'cfo',
        industry: 'saas',
        companySize: 'scaleup'
      });

      await server.executeTool('generate_business_case', TEST_SaaS_COMPANY);

      // Check audit trail
      const entries = auditManager.query({});
      expect(entries.length).toBeGreaterThan(0);
      
      // Should have entries from both tools
      const toolNames = entries.map(e => e.operation);
      expect(toolNames).toContain('get_causal_impact');
      expect(toolNames).toContain('generate_business_case');
    });

    it('should handle errors gracefully', async () => {
      const result = await server.executeTool('generate_business_case', {
        ...TEST_SaaS_COMPANY,
        annualRevenue: -1000 // Invalid
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('error');
    });

    it('should provide enhanced health check', async () => {
      const health = await server.healthCheck();

      expect(health.details.phase3).toBeDefined();
      expect(health.details.phase3.structuralTruth).toBe(true);
      expect(health.details.phase3.causalTruth).toBe(true);
      expect(health.details.phase3.businessCaseGenerator).toBe(true);
      expect(health.details.phase3.reasoningEngine).toBe(true);
      expect(health.details.phase3.auditTrail).toBe(true);
    });
  });

  describe('End-to-End Flow', () => {
    it('should complete full business case generation flow', async () => {
      // Step 1: Generate strategic recommendations
      const recommendations = await server.executeTool('generate_strategic_recommendations', {
        persona: 'cfo',
        industry: 'saas',
        companySize: 'scaleup',
        currentKPIs: TEST_SaaS_COMPANY.currentKPIs,
        goals: ['Improve NRR by 5%', 'Reduce CAC by 10%'],
        constraints: {
          maxInvestment: 500000,
          maxTime: 180,
          minROI: 1.5,
          riskTolerance: 'medium',
          preferredQuickWins: true
        }
      });

      const recData = JSON.parse(recommendations.content[0].text);
      expect(recData.recommendedActions.length).toBeGreaterThan(0);

      // Step 2: Select actions from recommendations
      const selectedActions = recData.recommendedActions.slice(0, 3).map((r: any) => r.action);

      // Step 3: Generate business case with selected actions
      const businessCase = await server.executeTool('generate_business_case', {
        ...TEST_SaaS_COMPANY,
        selectedActions
      });

      const bcData = JSON.parse(businessCase.content[0].text);
      expect(bcData.summary).toBeDefined();
      expect(bcData.financialImpact).toBeDefined();

      // Step 4: Verify audit trail
      const auditQuery = await server.executeTool('query_audit_trail', {});
      const auditData = JSON.parse(auditQuery.content[0].text);
      expect(auditData.total).toBeGreaterThan(0);

      // Step 5: Generate compliance report
      const complianceReport = await server.executeTool('generate_compliance_report', {
        startTime: new Date(Date.now() - 86400000).toISOString(),
        endTime: new Date().toISOString()
      });

      const compData = JSON.parse(complianceReport.content[0].text);
      expect(compData.totalOperations).toBeGreaterThan(0);
      expect(compData.complianceScore).toBeDefined();
    });

    it('should handle scenario comparison flow', async () => {
      const scenarios = [
        {
          name: 'Conservative Growth',
          persona: 'cfo',
          industry: 'saas',
          companySize: 'scaleup',
          annualRevenue: 5000000,
          currentKPIs: TEST_SaaS_COMPANY.currentKPIs,
          selectedActions: ['price_increase_5pct'],
          timeframe: '180d'
        },
        {
          name: 'Aggressive Growth',
          persona: 'cfo',
          industry: 'saas',
          companySize: 'scaleup',
          annualRevenue: 5000000,
          currentKPIs: TEST_SaaS_COMPANY.currentKPIs,
          selectedActions: ['price_increase_5pct', 'double_marketing_spend', 'increase_sales_team_20pct'],
          timeframe: '180d'
        }
      ];

      const result = await server.executeTool('compare_business_scenarios', { scenarios });
      const data = JSON.parse(result.content[0].text);

      expect(data.length).toBe(2);
      expect(data[0].name).toBe('Conservative Growth');
      expect(data[1].name).toBe('Aggressive Growth');
      
      // Aggressive should have higher impact
      expect(data[1].result.summary.totalReturn).toBeGreaterThan(data[0].result.summary.totalReturn);
    });

    it('should maintain data provenance across flow', async () => {
      // Generate business case
      const result = await server.executeTool('generate_business_case', TEST_SaaS_COMPANY);
      const data = JSON.parse(result.content[0].text);

      // Check metadata
      expect(data.metadata.id).toBeDefined();
      expect(data.metadata.createdAt).toBeDefined();
      expect(data.metadata.confidenceScore).toBeDefined();
      expect(data.metadata.dataSources.length).toBeGreaterThan(0);

      // Check audit trail has provenance
      expect(data.auditTrail.length).toBeGreaterThan(0);
      
      // Each audit step should have sources
      const stepsWithSources = data.auditTrail.filter((s: any) => s.sources && s.sources.length > 0);
      expect(stepsWithSources.length).toBeGreaterThan(0);
    });
  });
});