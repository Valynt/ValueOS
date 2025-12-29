# Phase 3 Quick Start Guide

Get started with the Phase 3 Integration & Business Case Generation system in 5 minutes.

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests to verify installation
npm test -- phase3-integration
```

## Basic Usage

### 1. Initialize the Integrated Server

```typescript
import { createIntegratedMCPServer } from './src/mcp-ground-truth/core/IntegratedMCPServer';

const server = await createIntegratedMCPServer({
  edgar: { userAgent: 'MyApp/1.0', rateLimit: 10 },
  marketData: { 
    provider: 'alphavantage', 
    apiKey: process.env.ALPHA_VANTAGE_API_KEY 
  },
  industryBenchmark: { enableStaticData: true },
  auditTrail: { enabled: true, maxEntries: 10000 }
});
```

### 2. Generate Your First Business Case

```typescript
const result = await server.executeTool('generate_business_case', {
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
  selectedActions: [
    'price_increase_5pct',
    'implement_health_scoring',
    'improve_page_load_50pct'
  ],
  timeframe: '180d',
  confidenceThreshold: 0.7
});

const businessCase = JSON.parse(result.content[0].text);
console.log(JSON.stringify(businessCase, null, 2));
```

### 3. Get Strategic Recommendations

```typescript
const result = await server.executeTool('generate_strategic_recommendations', {
  persona: 'cfo',
  industry: 'saas',
  companySize: 'scaleup',
  currentKPIs: {
    saas_arr: 5000000,
    saas_nrr: 95,
    saas_cac: 800
  },
  goals: ['Improve NRR by 5%', 'Reduce CAC by 10%'],
  constraints: {
    maxInvestment: 500000,
    maxTime: 180,
    minROI: 1.5,
    riskTolerance: 'medium',
    preferredQuickWins: true
  }
});

const recommendations = JSON.parse(result.content[0].text);
console.log(recommendations.strategy);
console.log(recommendations.recommendedActions);
```

### 4. Compare Multiple Scenarios

```typescript
const result = await server.executeTool('compare_business_scenarios', {
  scenarios: [
    {
      name: 'Conservative',
      persona: 'cfo',
      industry: 'saas',
      companySize: 'scaleup',
      annualRevenue: 5000000,
      currentKPIs: { saas_arr: 5000000, saas_nrr: 95, ... },
      selectedActions: ['price_increase_5pct'],
      timeframe: '180d'
    },
    {
      name: 'Aggressive',
      persona: 'cfo',
      industry: 'saas',
      companySize: 'scaleup',
      annualRevenue: 5000000,
      currentKPIs: { saas_arr: 5000000, saas_nrr: 95, ... },
      selectedActions: ['price_increase_5pct', 'double_marketing_spend', 'increase_sales_team_20pct'],
      timeframe: '180d'
    }
  ]
});

const scenarios = JSON.parse(result.content[0].text);
scenarios.forEach(s => {
  console.log(`${s.name}: ROI = ${s.result.summary.roi.toFixed(2)}x`);
});
```

### 5. Query Audit Trail

```typescript
const result = await server.executeTool('query_audit_trail', {
  startTime: new Date(Date.now() - 86400000).toISOString(), // Last 24 hours
  endTime: new Date().toISOString(),
  level: ['INFO', 'WARN', 'ERROR'],
  minConfidence: 0.5
});

const auditData = JSON.parse(result.content[0].text);
console.log(`Found ${auditData.total} audit entries`);
```

### 6. Generate Compliance Report

```typescript
const result = await server.executeTool('generate_compliance_report', {
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-12-31T23:59:59Z'
});

const report = JSON.parse(result.content[0].text);
console.log(`Compliance Score: ${report.complianceScore}%`);
console.log(`Violations: ${report.violations.length}`);
```

## Common Workflows

### Workflow 1: Complete Business Case Analysis

```typescript
// Step 1: Get recommendations
const recs = await server.executeTool('generate_strategic_recommendations', {
  persona: 'cfo',
  industry: 'saas',
  companySize: 'scaleup',
  currentKPIs: { /* your KPIs */ },
  goals: ['Improve NRR by 5%'],
  constraints: { maxInvestment: 500000, maxTime: 180 }
});

// Step 2: Select top actions
const recommendations = JSON.parse(recs.content[0].text);
const selectedActions = recommendations.recommendedActions
  .slice(0, 3)
  .map(r => r.action);

// Step 3: Generate business case
const bc = await server.executeTool('generate_business_case', {
  persona: 'cfo',
  industry: 'saas',
  companySize: 'scaleup',
  annualRevenue: 5000000,
  currentKPIs: { /* your KPIs */ },
  selectedActions: selectedActions,
  timeframe: '180d'
});

// Step 4: Analyze results
const businessCase = JSON.parse(bc.content[0].text);
console.log(`ROI: ${businessCase.summary.roi.toFixed(2)}x`);
console.log(`NPV: $${businessCase.summary.netPresentValue.toLocaleString()}`);
console.log(`Risk Level: ${businessCase.summary.riskLevel}`);
```

### Workflow 2: Scenario Comparison

```typescript
const scenarios = [
  {
    name: 'Price Focus',
    actions: ['price_increase_5pct', 'annual_commitment_discount']
  },
  {
    name: 'Growth Focus',
    actions: ['double_marketing_spend', 'increase_sales_team_20pct']
  },
  {
    name: 'Efficiency Focus',
    actions: ['automate_manual_processes', 'implement_health_scoring']
  }
];

const results = [];
for (const scenario of scenarios) {
  const result = await server.executeTool('generate_business_case', {
    persona: 'cfo',
    industry: 'saas',
    companySize: 'scaleup',
    annualRevenue: 5000000,
    currentKPIs: { /* your KPIs */ },
    selectedActions: scenario.actions,
    timeframe: '180d'
  });
  
  const businessCase = JSON.parse(result.content[0].text);
  results.push({
    name: scenario.name,
    roi: businessCase.summary.roi,
    npv: businessCase.summary.netPresentValue,
    risk: businessCase.summary.riskLevel
  });
}

// Find best scenario
const best = results.reduce((a, b) => a.roi > b.roi ? a : b);
console.log(`Best scenario: ${best.name} with ROI ${best.roi.toFixed(2)}x`);
```

### Workflow 3: Compliance Monitoring

```typescript
// Check current compliance
const dashboard = await server.executeTool('get_compliance_dashboard', {});
const dashboardData = JSON.parse(dashboard.content[0].text);

console.log(`Health: ${dashboardData.health}`);
console.log(`Compliance Score: ${dashboardData.complianceScore}%`);

if (dashboardData.anomalies.length > 0) {
  console.log('Anomalies detected:');
  dashboardData.anomalies.forEach(a => console.log(`  - ${a}`));
}

// Verify integrity
const integrity = await server.executeTool('verify_audit_integrity', {});
const integrityData = JSON.parse(integrity.content[0].text);

if (!integrityData.valid) {
  console.error('INTEGRITY ISSUES:', integrityData.issues);
} else {
  console.log('✓ Audit integrity verified');
}
```

## API Reference

### Core Tools

| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `generate_business_case` | Generate complete business case | persona, industry, companySize, annualRevenue, currentKPIs, selectedActions, timeframe |
| `generate_strategic_recommendations` | Get strategic recommendations | persona, industry, companySize, currentKPIs, goals |
| `compare_business_scenarios` | Compare multiple scenarios | scenarios (array) |
| `get_causal_impact` | Get action impact on KPI | action, kpi, persona, industry, companySize |
| `simulate_action_outcome` | Simulate action on multiple KPIs | action, baseline, persona, industry, companySize |
| `query_audit_trail` | Query audit entries | (optional filters) |
| `generate_compliance_report` | Generate compliance report | startTime, endTime |
| `verify_audit_integrity` | Verify audit integrity | (none) |
| `get_compliance_dashboard` | Get compliance dashboard | (none) |

### Input Types

**BusinessCaseRequest**:
```typescript
{
  persona: 'cfo' | 'cio' | 'cto' | 'coo' | 'vp_sales' | 'vp_ops' | 'vp_engineering' | 'director_finance' | 'data_analyst',
  industry: 'saas' | 'manufacturing' | 'healthcare' | 'finance' | 'retail' | 'technology' | 'professional_services',
  companySize: 'startup' | 'scaleup' | 'enterprise',
  annualRevenue: number,
  currentKPIs: Record<string, number>,
  selectedActions: string[],
  timeframe: '30d' | '90d' | '180d' | '365d',
  confidenceThreshold?: number,
  scenarioName?: string
}
```

**ReasoningRequest**:
```typescript
{
  persona: string,
  industry: string,
  companySize: string,
  currentKPIs: Record<string, number>,
  goals: string[],
  constraints?: {
    maxInvestment?: number,
    maxTime?: number,
    minROI?: number,
    riskTolerance?: 'low' | 'medium' | 'high',
    preferredQuickWins?: boolean
  }
}
```

## Error Handling

```typescript
try {
  const result = await server.executeTool('generate_business_case', request);
  
  if (result.isError) {
    const error = JSON.parse(result.content[0].text);
    console.error('Business case generation failed:', error);
  } else {
    const businessCase = JSON.parse(result.content[0].text);
    console.log('Success:', businessCase.summary);
  }
} catch (error) {
  console.error('Execution failed:', error);
}
```

## Performance Tips

1. **Use constraints**: Limit maxTime and investment to reduce computation
2. **Batch operations**: Use compare_scenarios instead of multiple calls
3. **Cache results**: Store business cases for reuse
4. **Monitor audit trail**: Regular cleanup of old entries
5. **Enable parallel queries**: Set `parallelQuery: true` in config

## Next Steps

- Read the [Full Documentation](./PHASE3_INTEGRATION.md)
- Explore the [API Reference](./API_REFERENCE.md)
- Check out [Examples](./EXAMPLES.md)
- Review [Best Practices](./BEST_PRACTICES.md)