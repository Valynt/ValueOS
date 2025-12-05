/**
 * Value Model Examples
 * 
 * Canonical examples for few-shot prompting and RAG retrieval.
 * These examples guide the LLM in generating well-structured value cases.
 */

export interface ValueModelExample {
  id: string;
  industry: string;
  useCase: string;
  title: string;
  summary: string;
  content: ValueModelContent;
  tags: string[];
}

export interface ValueModelContent {
  businessObjective: string;
  currentState: {
    description: string;
    painPoints: string[];
    metrics: { name: string; value: string; unit: string }[];
  };
  futureState: {
    description: string;
    capabilities: string[];
    metrics: { name: string; value: string; unit: string }[];
  };
  valueDrivers: {
    category: 'revenue' | 'cost' | 'risk' | 'strategic';
    description: string;
    annualImpact: number;
    confidence: number;
  }[];
  kpis: {
    name: string;
    baseline: number;
    target: number;
    unit: string;
    timeframe: string;
  }[];
  implementation: {
    phases: { name: string; duration: string; deliverables: string[] }[];
    totalInvestment: number;
    paybackPeriod: string;
  };
  roi: {
    threeYearValue: number;
    netPresentValue: number;
    internalRateOfReturn: number;
  };
}

export const VALUE_MODEL_EXAMPLES: ValueModelExample[] = [
  {
    id: 'manufacturing-predictive-maintenance',
    industry: 'Manufacturing',
    useCase: 'Predictive Maintenance',
    title: 'Predictive Maintenance for Industrial Equipment',
    summary: 'Reduce unplanned downtime by 40% through ML-powered equipment failure prediction',
    tags: ['manufacturing', 'iot', 'predictive', 'maintenance', 'ml'],
    content: {
      businessObjective: 'Reduce unplanned equipment downtime and maintenance costs while extending asset lifespan through predictive maintenance capabilities.',
      currentState: {
        description: 'Reactive maintenance approach with scheduled preventive maintenance cycles regardless of actual equipment condition.',
        painPoints: [
          'Unplanned downtime costs $50K per hour in lost production',
          'Maintenance technicians spend 40% of time on unnecessary preventive tasks',
          'Equipment failures cause safety incidents and quality issues',
          'Spare parts inventory is either overstocked or unavailable when needed'
        ],
        metrics: [
          { name: 'Unplanned Downtime', value: '12', unit: '% of production time' },
          { name: 'Maintenance Cost', value: '4.2', unit: 'M annually' },
          { name: 'Mean Time Between Failures', value: '45', unit: 'days' },
          { name: 'Spare Parts Inventory Cost', value: '1.8', unit: 'M' }
        ]
      },
      futureState: {
        description: 'AI-powered predictive maintenance system that forecasts equipment failures 2-4 weeks in advance, enabling optimized maintenance scheduling.',
        capabilities: [
          'Real-time equipment health monitoring via IoT sensors',
          'ML models predicting failure probability and remaining useful life',
          'Automated work order generation and scheduling optimization',
          'Spare parts demand forecasting and inventory optimization'
        ],
        metrics: [
          { name: 'Unplanned Downtime', value: '7', unit: '% of production time' },
          { name: 'Maintenance Cost', value: '2.9', unit: 'M annually' },
          { name: 'Mean Time Between Failures', value: '72', unit: 'days' },
          { name: 'Spare Parts Inventory Cost', value: '1.2', unit: 'M' }
        ]
      },
      valueDrivers: [
        {
          category: 'cost',
          description: 'Reduced unplanned downtime from 12% to 7%',
          annualImpact: 2500000,
          confidence: 0.85
        },
        {
          category: 'cost',
          description: 'Maintenance cost reduction through optimized scheduling',
          annualImpact: 1300000,
          confidence: 0.80
        },
        {
          category: 'cost',
          description: 'Spare parts inventory optimization',
          annualImpact: 600000,
          confidence: 0.75
        },
        {
          category: 'risk',
          description: 'Reduced safety incidents from equipment failures',
          annualImpact: 400000,
          confidence: 0.70
        }
      ],
      kpis: [
        { name: 'Overall Equipment Effectiveness (OEE)', baseline: 72, target: 85, unit: '%', timeframe: '18 months' },
        { name: 'Unplanned Downtime', baseline: 12, target: 7, unit: '%', timeframe: '12 months' },
        { name: 'Maintenance Cost per Unit', baseline: 42, target: 29, unit: '$', timeframe: '12 months' },
        { name: 'Prediction Accuracy', baseline: 0, target: 85, unit: '%', timeframe: '6 months' }
      ],
      implementation: {
        phases: [
          { name: 'Foundation', duration: '3 months', deliverables: ['IoT sensor deployment', 'Data pipeline setup', 'Historical data ingestion'] },
          { name: 'Model Development', duration: '4 months', deliverables: ['ML model training', 'Validation on pilot equipment', 'Integration with CMMS'] },
          { name: 'Scale & Optimize', duration: '5 months', deliverables: ['Full equipment rollout', 'Model retraining automation', 'Mobile app for technicians'] }
        ],
        totalInvestment: 2800000,
        paybackPeriod: '14 months'
      },
      roi: {
        threeYearValue: 14400000,
        netPresentValue: 9200000,
        internalRateOfReturn: 0.72
      }
    }
  },
  {
    id: 'retail-demand-forecasting',
    industry: 'Retail',
    useCase: 'Demand Forecasting',
    title: 'AI-Powered Demand Forecasting for Inventory Optimization',
    summary: 'Improve forecast accuracy by 35% to reduce stockouts and overstock situations',
    tags: ['retail', 'forecasting', 'inventory', 'supply-chain', 'ml'],
    content: {
      businessObjective: 'Optimize inventory levels across 200+ stores by improving demand forecast accuracy, reducing both stockouts and excess inventory.',
      currentState: {
        description: 'Traditional statistical forecasting with manual adjustments by category managers, leading to inconsistent accuracy across SKUs.',
        painPoints: [
          'Stockouts result in $8M annual lost sales',
          'Excess inventory leads to $12M in annual markdowns',
          'Planners spend 60% of time on manual forecast adjustments',
          'New product forecasts are highly inaccurate (45% MAPE)'
        ],
        metrics: [
          { name: 'Forecast Accuracy (MAPE)', value: '32', unit: '%' },
          { name: 'Stockout Rate', value: '8', unit: '% of SKUs' },
          { name: 'Inventory Turns', value: '4.2', unit: 'per year' },
          { name: 'Markdown Rate', value: '22', unit: '% of revenue' }
        ]
      },
      futureState: {
        description: 'ML-based demand sensing platform incorporating external signals (weather, events, social trends) for granular, automated forecasting.',
        capabilities: [
          'Store-SKU level daily demand forecasting',
          'External signal integration (weather, events, promotions)',
          'Automated replenishment recommendations',
          'New product demand estimation using similar item analysis'
        ],
        metrics: [
          { name: 'Forecast Accuracy (MAPE)', value: '21', unit: '%' },
          { name: 'Stockout Rate', value: '4', unit: '% of SKUs' },
          { name: 'Inventory Turns', value: '5.8', unit: 'per year' },
          { name: 'Markdown Rate', value: '16', unit: '% of revenue' }
        ]
      },
      valueDrivers: [
        {
          category: 'revenue',
          description: 'Reduced stockouts increasing sales capture',
          annualImpact: 4800000,
          confidence: 0.82
        },
        {
          category: 'cost',
          description: 'Reduced markdowns from better inventory positioning',
          annualImpact: 7200000,
          confidence: 0.78
        },
        {
          category: 'cost',
          description: 'Improved inventory turns reducing carrying costs',
          annualImpact: 2100000,
          confidence: 0.75
        },
        {
          category: 'cost',
          description: 'Planner productivity improvement',
          annualImpact: 800000,
          confidence: 0.85
        }
      ],
      kpis: [
        { name: 'Forecast Accuracy (MAPE)', baseline: 32, target: 21, unit: '%', timeframe: '9 months' },
        { name: 'Stockout Rate', baseline: 8, target: 4, unit: '%', timeframe: '12 months' },
        { name: 'Inventory Turns', baseline: 4.2, target: 5.8, unit: 'x', timeframe: '18 months' },
        { name: 'Planner Time on Manual Adjustments', baseline: 60, target: 20, unit: '%', timeframe: '6 months' }
      ],
      implementation: {
        phases: [
          { name: 'Data Foundation', duration: '2 months', deliverables: ['Data warehouse integration', 'External data sources', 'Data quality remediation'] },
          { name: 'Model Build', duration: '3 months', deliverables: ['Demand sensing models', 'Category-specific tuning', 'A/B testing framework'] },
          { name: 'Rollout', duration: '4 months', deliverables: ['Phased store rollout', 'Planner training', 'Replenishment integration'] }
        ],
        totalInvestment: 3200000,
        paybackPeriod: '8 months'
      },
      roi: {
        threeYearValue: 44700000,
        netPresentValue: 31200000,
        internalRateOfReturn: 1.45
      }
    }
  },
  {
    id: 'healthcare-patient-flow',
    industry: 'Healthcare',
    useCase: 'Patient Flow Optimization',
    title: 'AI-Driven Patient Flow and Capacity Management',
    summary: 'Reduce ED wait times by 30% and improve bed utilization through predictive capacity management',
    tags: ['healthcare', 'hospital', 'patient-flow', 'capacity', 'operations'],
    content: {
      businessObjective: 'Optimize patient flow across the hospital system to reduce wait times, improve bed utilization, and enhance patient experience while maintaining quality of care.',
      currentState: {
        description: 'Manual bed management with limited visibility into real-time capacity, leading to bottlenecks and inefficient resource allocation.',
        painPoints: [
          'ED boarding times average 4+ hours during peak periods',
          'Bed turnaround time is 90 minutes, creating admission delays',
          'Staff overtime costs $3.2M annually due to capacity mismatches',
          'Patient satisfaction scores impacted by wait times'
        ],
        metrics: [
          { name: 'ED Wait Time', value: '185', unit: 'minutes' },
          { name: 'Bed Utilization', value: '78', unit: '%' },
          { name: 'Left Without Being Seen', value: '4.2', unit: '%' },
          { name: 'Bed Turnaround Time', value: '90', unit: 'minutes' }
        ]
      },
      futureState: {
        description: 'Integrated command center with AI-powered demand prediction, automated bed assignment, and real-time capacity visibility across all units.',
        capabilities: [
          'Hourly patient volume prediction by acuity level',
          'Automated bed assignment based on predicted discharges',
          'Real-time capacity dashboard with alerts',
          'Staff scheduling optimization based on predicted demand'
        ],
        metrics: [
          { name: 'ED Wait Time', value: '130', unit: 'minutes' },
          { name: 'Bed Utilization', value: '88', unit: '%' },
          { name: 'Left Without Being Seen', value: '2.1', unit: '%' },
          { name: 'Bed Turnaround Time', value: '55', unit: 'minutes' }
        ]
      },
      valueDrivers: [
        {
          category: 'revenue',
          description: 'Increased patient throughput from better bed utilization',
          annualImpact: 4200000,
          confidence: 0.75
        },
        {
          category: 'cost',
          description: 'Reduced staff overtime through better scheduling',
          annualImpact: 1800000,
          confidence: 0.80
        },
        {
          category: 'revenue',
          description: 'Reduced LWBS rate capturing more ED visits',
          annualImpact: 1200000,
          confidence: 0.70
        },
        {
          category: 'strategic',
          description: 'Improved patient satisfaction and reputation',
          annualImpact: 800000,
          confidence: 0.65
        }
      ],
      kpis: [
        { name: 'ED Wait Time', baseline: 185, target: 130, unit: 'min', timeframe: '12 months' },
        { name: 'Bed Utilization', baseline: 78, target: 88, unit: '%', timeframe: '9 months' },
        { name: 'LWBS Rate', baseline: 4.2, target: 2.1, unit: '%', timeframe: '12 months' },
        { name: 'Patient Satisfaction', baseline: 72, target: 85, unit: 'NPS', timeframe: '18 months' }
      ],
      implementation: {
        phases: [
          { name: 'Command Center', duration: '3 months', deliverables: ['Real-time dashboards', 'Data integration', 'Alert system'] },
          { name: 'Predictive Models', duration: '4 months', deliverables: ['Demand forecasting', 'Discharge prediction', 'Bed assignment AI'] },
          { name: 'Optimization', duration: '5 months', deliverables: ['Staff scheduling integration', 'Workflow automation', 'Continuous improvement'] }
        ],
        totalInvestment: 2400000,
        paybackPeriod: '11 months'
      },
      roi: {
        threeYearValue: 24000000,
        netPresentValue: 15800000,
        internalRateOfReturn: 0.98
      }
    }
  }
];

/**
 * Get examples relevant to a query for few-shot prompting
 */
export function getRelevantExamples(
  query: string, 
  industry?: string, 
  maxExamples: number = 2
): ValueModelExample[] {
  const queryLower = query.toLowerCase();
  
  // Score each example by relevance
  const scored = VALUE_MODEL_EXAMPLES.map(example => {
    let score = 0;
    
    // Industry match
    if (industry && example.industry.toLowerCase() === industry.toLowerCase()) {
      score += 10;
    }
    
    // Tag matches
    example.tags.forEach(tag => {
      if (queryLower.includes(tag)) score += 3;
    });
    
    // Title/summary keyword match
    if (queryLower.includes(example.useCase.toLowerCase())) score += 5;
    example.title.toLowerCase().split(' ').forEach(word => {
      if (queryLower.includes(word) && word.length > 3) score += 1;
    });
    
    return { example, score };
  });
  
  // Sort by score and return top N
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExamples)
    .map(s => s.example);
}

/**
 * Format example for inclusion in LLM prompt
 */
export function formatExampleForPrompt(example: ValueModelExample): string {
  const c = example.content;
  return `
## Example: ${example.title}
**Industry**: ${example.industry}
**Objective**: ${c.businessObjective}

**Current State**:
${c.currentState.painPoints.map(p => `- ${p}`).join('\n')}

**Key Metrics**:
| Metric | Current | Target | Impact |
|--------|---------|--------|--------|
${c.kpis.map(k => `| ${k.name} | ${k.baseline}${k.unit} | ${k.target}${k.unit} | ${k.timeframe} |`).join('\n')}

**Value Drivers**:
${c.valueDrivers.map(v => `- ${v.description}: $${(v.annualImpact / 1000000).toFixed(1)}M/year (${Math.round(v.confidence * 100)}% confidence)`).join('\n')}

**ROI Summary**:
- 3-Year Value: $${(c.roi.threeYearValue / 1000000).toFixed(1)}M
- NPV: $${(c.roi.netPresentValue / 1000000).toFixed(1)}M  
- Payback: ${c.implementation.paybackPeriod}
`.trim();
}
