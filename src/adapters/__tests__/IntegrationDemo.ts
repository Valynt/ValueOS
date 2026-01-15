/**
 * Phase 3.5 Integration Demo
 * 
 * Demonstrates the complete data flow from Ground Truth Engine → Templates
 * Shows how the adapter bridges Phase 3 and Phase 4
 */

import { IntegratedMCPServer } from '../../mcp-ground-truth/core/IntegratedMCPServer';
import { adaptBusinessCaseToTemplate, selectTemplateByContext, IntegrationManager } from '../BusinessCaseAdapter';
import { BusinessCaseResult } from '../../causal/business-case-generator-enhanced';

/**
 * COMPLETE INTEGRATION WORKFLOW
 * 
 * This demonstrates the 3-Point Integration Strategy:
 * 1. Data Pipeline (The "Fuel")
 * 2. Intelligent Template Selection (The "Brain")
 * 3. Visualizing the Truth (The "Trust")
 */
export async function demonstratePhase3_5Integration() {
  console.log('🚀 Phase 3.5 Integration Demo: Ground Truth Engine → Template Library\n');

  // STEP 1: Generate Business Case using Phase 3 Engine
  console.log('1. Generating Business Case with Ground Truth Engine...');
  
  const server = new IntegratedMCPServer({
    edgar: { userAgent: 'Demo/1.0', rateLimit: 10 },
    marketData: { provider: 'alphavantage', apiKey: 'demo-key' },
    industryBenchmark: { enableStaticData: true },
    auditTrail: { enabled: true, maxEntries: 1000 }
  });
  
  await server.initialize();

  const businessCaseResult = await server.executeTool('generate_business_case', {
    persona: 'cfo',
    industry: 'saas',
    companySize: 'scaleup',
    annualRevenue: 5000000,
    currentKPIs: {
      saas_arr: 5000000,
      saas_nrr: 95,
      saas_logo_churn: 12,
      saas_cac: 800,
      saas_ltv: 12000,
      saas_arpu: 150
    },
    selectedActions: ['price_increase_5pct', 'implement_health_scoring', 'improve_page_load_50pct'],
    timeframe: '180d',
    confidenceThreshold: 0.7
  });

  const businessCase: BusinessCaseResult = JSON.parse(businessCaseResult.content[0].text);
  
  console.log(`   ✓ Generated business case with ${businessCase.auditTrail.length} audit steps`);
  console.log(`   ✓ ROI: ${(businessCase.summary.roi * 100).toFixed(1)}%`);
  console.log(`   ✓ NPV: $${businessCase.summary.netPresentValue.toLocaleString()}\n`);

  // STEP 2: Apply Phase 3.5 Adapter (Data Pipeline)
  console.log('2. Running Phase 3.5 Adapter (Data Pipeline)...');
  
  const adapter = new IntegrationManager();
  const integrationResult = await adapter.processBusinessCase(businessCase);
  
  console.log(`   ✓ Template Selected: ${integrationResult.templateName}`);
  console.log(`   ✓ Metrics Mapped: ${integrationResult.templateData.metrics.length} KPIs`);
  console.log(`   ✓ Financials Extracted: ${Object.keys(integrationResult.templateData.financials).length} fields`);
  console.log(`   ✓ Causal Chains: ${integrationResult.templateData.outcomes.length} pathways`);
  console.log(`   ✓ Audit Evidence: ${integrationResult.templateData.evidence.length} entries\n`);

  // STEP 3: Show Data Transformation (The "Fuel")
  console.log('3. Data Pipeline Results (The "Fuel"):\n');
  
  // Structural Truth → Metrics
  console.log('   📊 Structural Truth → Metrics:');
  integrationResult.templateData.metrics.slice(0, 3).forEach(m => {
    console.log(`      ${m.name}: ${m.baseline} → ${m.value} (${m.changePercent > 0 ? '+' : ''}${m.changePercent.toFixed(1)}%)`);
  });
  
  // Business Case → Financials
  console.log('\n   💰 Business Case → Financials:');
  const f = integrationResult.templateData.financials;
  console.log(`      ROI: ${(f.roi * 100).toFixed(1)}%`);
  console.log(`      NPV: $${f.netPresentValue.toLocaleString()}`);
  console.log(`      Payback: ${f.paybackPeriod.toFixed(0)} days`);
  
  // Causal Truth → Outcomes
  console.log('\n   ⚡ Causal Truth → Outcomes:');
  integrationResult.templateData.outcomes.slice(0, 2).forEach(o => {
    console.log(`      ${o.driver} → ${o.effect}: ${o.impact > 0 ? '+' : ''}${o.impact.toFixed(1)} (${(o.probability * 100).toFixed(0)}% probability)`);
  });

  // STEP 4: Intelligent Template Selection (The "Brain")
  console.log('\n4. Intelligent Template Selection (The "Brain"):\n');
  
  const context = integrationResult.templateData.context;
  console.log(`   Persona: ${context.persona}`);
  console.log(`   Industry: ${context.industry}`);
  console.log(`   Risk Level: ${context.riskLevel}`);
  console.log(`   Confidence: ${(context.confidenceScore * 100).toFixed(0)}%`);
  console.log(`   → Selected: ${integrationResult.templateName}`);
  
  // Show why this template was chosen
  if (context.persona === 'cfo') {
    console.log('   → Reasoning: CFO persona prioritizes cash flow and risk → Trinity Dashboard');
  }

  // STEP 5: Trust Badges (The "Trust")
  console.log('\n5. Visualizing the Truth (The "Trust"):\n');
  
  const trustBadges = integrationResult.trustBadges.filter(tb => tb.badge !== null).slice(0, 3);
  trustBadges.forEach(({ metric, badge }) => {
    if (badge) {
      console.log(`   🛡️  ${metric}:`);
      console.log(`      Value: ${badge.value}`);
      console.log(`      Confidence: ${(badge.confidence * 100).toFixed(0)}%`);
      console.log(`      Formula: ${badge.formula}`);
      console.log(`      Hash: ${badge.hash.substring(0, 16)}...`);
      console.log(`      Sources: ${badge.sources.join(', ')}`);
    }
  });

  // STEP 6: Complete Integration Result
  console.log('\n6. Complete Integration Result:\n');
  console.log(JSON.stringify({
    template: integrationResult.templateName,
    metrics: integrationResult.templateData.metrics.length,
    financials: {
      roi: (integrationResult.templateData.financials.roi * 100).toFixed(1) + '%',
      npv: '$' + integrationResult.templateData.financials.netPresentValue.toLocaleString()
    },
    outcomes: integrationResult.templateData.outcomes.length,
    evidence: integrationResult.templateData.evidence.length,
    trustBadges: trustBadges.length,
    metadata: integrationResult.metadata
  }, null, 2));

  console.log('\n✅ Phase 3.5 Integration Complete!');
  console.log('   → Ground Truth Engine data is now template-ready');
  console.log('   → Every number is backed by cryptographic proof');
  console.log('   → Templates can display real, audited data');
}

/**
 * SCENARIO: Persona-Driven Template Switching
 * 
 * Shows how the Reasoning Engine drives template selection
 */
export async function demonstratePersonaSwitching() {
  console.log('\n🎯 Persona-Driven Template Switching Demo\n');

  const server = new IntegratedMCPServer({
    edgar: { userAgent: 'Demo/1.0', rateLimit: 10 },
    marketData: { provider: 'alphavantage', apiKey: 'demo-key' },
    industryBenchmark: { enableStaticData: true },
    auditTrail: { enabled: true }
  });
  
  await server.initialize();

  // Generate business case
  const result = await server.executeTool('generate_business_case', {
    persona: 'cfo',
    industry: 'saas',
    companySize: 'scaleup',
    annualRevenue: 5000000,
    currentKPIs: { saas_arr: 5000000, saas_nrr: 95, saas_cac: 800 },
    selectedActions: ['price_increase_5pct'],
    timeframe: '180d'
  });

  const businessCase = JSON.parse(result.content[0].text);
  const adapter = new IntegrationManager();
  const integration = await adapter.processBusinessCase(businessCase);

  console.log(`Initial Template: ${integration.templateName} (for CFO)\n`);

  // Simulate persona switch
  const personas = ['cfo', 'cto', 'vp_sales', 'vp_product'];
  
  for (const persona of personas) {
    const newTemplate = await adapter.switchTemplate(persona, integration.templateData);
    console.log(`   ${persona.toUpperCase()}: ${newTemplate}`);
  }

  console.log('\n→ Templates adapt automatically to user role!');
}

/**
 * SCENARIO: Trust Overlay Injection
 * 
 * Shows how to add cryptographic proof to any template
 */
export async function demonstrateTrustOverlay() {
  console.log('\n🔒 Trust Overlay Demo\n');

  const server = new IntegratedMCPServer({
    edgar: { userAgent: 'Demo/1.0', rateLimit: 10 },
    marketData: { provider: 'alphavantage', apiKey: 'demo-key' },
    industryBenchmark: { enableStaticData: true },
    auditTrail: { enabled: true }
  });
  
  await server.initialize();

  const result = await server.executeTool('generate_business_case', {
    persona: 'cfo',
    industry: 'saas',
    companySize: 'scaleup',
    annualRevenue: 5000000,
    currentKPIs: { saas_arr: 5000000, saas_nrr: 95 },
    selectedActions: ['price_increase_5pct'],
    timeframe: '180d'
  });

  const businessCase = JSON.parse(result.content[0].text);
  const adapter = new IntegrationManager();
  const integration = await adapter.processBusinessCase(businessCase);

  // Add trust overlay
  const withTrust = await adapter.addTrustOverlay(integration.templateData, businessCase);

  console.log('Template Data + Trust Overlay:\n');
  console.log('Metrics with Trust:');
  withTrust.metrics.slice(0, 2).forEach(m => {
    const trust = withTrust.trustOverlay.find(t => t.metric === m.name);
    if (trust && trust.trust) {
      console.log(`   ${m.name}: ${m.value}`);
      console.log(`      └─ Trust: ${(trust.trust.confidence * 100).toFixed(0)}% | Hash: ${trust.trust.hash.substring(0, 12)}...`);
    }
  });

  console.log('\n→ Every metric now has cryptographic proof on hover!');
}

/**
 * MAIN DEMO RUNNER
 */
export async function runPhase3_5Demo() {
  console.log('='.repeat(80));
  console.log('PHASE 3.5 INTEGRATION DEMONSTRATION');
  console.log('Bridge: Ground Truth Engine ↔ Template Library');
  console.log('='.repeat(80));
  console.log();

  try {
    await demonstratePhase3_5Integration();
    await demonstratePersonaSwitching();
    await demonstrateTrustOverlay();
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL DEMOS COMPLETE');
    console.log('='.repeat(80));
    console.log('\nKey Takeaways:');
    console.log('1. Data Pipeline: Phase 3 outputs → Phase 4 inputs (automated)');
    console.log('2. Intelligent Selection: Reasoning Engine picks the right template');
    console.log('3. Trust Layer: Every number has cryptographic proof');
    console.log('4. Result: Beautiful templates showing mathematically proven data');
    
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runPhase3_5Demo();
}