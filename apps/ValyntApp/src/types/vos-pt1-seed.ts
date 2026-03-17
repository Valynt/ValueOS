// ============================================================================
// VOS-PT-1 — Value Model Reasoning Trace Seeds
//
// Each seed captures a complete reasoning chain from opportunity identification
// through financial impact quantification. Used by the ESO module to find
// similar traces when building new value cases.
// ============================================================================

export interface VMRTFinancialImpact {
  totalImpact: { amount: number; currency: string; timeframeMonths: number };
  recurring: boolean;
  confidenceLevel: number;
}

export interface VMRTReasoningStep {
  stepNumber: number;
  type: 'observation' | 'hypothesis' | 'evidence' | 'quantification' | 'recommendation';
  description: string;
  kpiReferences: string[];
}

export interface VMRTSeed {
  traceId: string;
  context: {
    organization: { industry: string; size: string; arr: number };
    persona: string;
  };
  valueModel: {
    outcomeCategory: 'cost_reduction' | 'revenue_growth' | 'risk_mitigation' | 'efficiency_gain';
    financialImpact: VMRTFinancialImpact;
  };
  reasoningSteps: VMRTReasoningStep[];
  qualityMetrics: {
    overallConfidence: number;
    dataCompleteness: number;
    benchmarkCoverage: number;
  };
}

export const ALL_VMRT_SEEDS: VMRTSeed[] = [
  // --------------------------------------------------------------------------
  // 1. NRR improvement via time-to-value acceleration
  // --------------------------------------------------------------------------
  {
    traceId: 'vmrt-001-nrr-ttv',
    context: {
      organization: { industry: 'Software', size: 'mid_market', arr: 25_000_000 },
      persona: 'vp_cs',
    },
    valueModel: {
      outcomeCategory: 'revenue_growth',
      financialImpact: {
        totalImpact: { amount: 3_750_000, currency: 'USD', timeframeMonths: 12 },
        recurring: true,
        confidenceLevel: 0.78,
      },
    },
    reasoningSteps: [
      {
        stepNumber: 1,
        type: 'observation',
        description: 'Current time-to-value is 60 days (between p25 and p50). NRR sits at 100%, below median.',
        kpiReferences: ['cust_time_to_value', 'saas_nrr'],
      },
      {
        stepNumber: 2,
        type: 'hypothesis',
        description: 'Reducing TTV from 60 to 30 days should improve NPS by 15 points within 3 months, driving churn reduction.',
        kpiReferences: ['cust_time_to_value', 'cust_nps', 'saas_gross_churn'],
      },
      {
        stepNumber: 3,
        type: 'evidence',
        description: 'ESO edge cust_time_to_value → cust_nps has weight 0.65 with 3-month lag. NPS → gross_churn inhibits at 0.70.',
        kpiReferences: ['cust_time_to_value', 'cust_nps', 'saas_gross_churn'],
      },
      {
        stepNumber: 4,
        type: 'quantification',
        description: 'Reducing gross churn from 12% to 8% and increasing expansion from 12% to 17% yields NRR of 109%, adding $2.25M ARR. Combined with new logo uplift, total impact is $3.75M.',
        kpiReferences: ['saas_gross_churn', 'saas_expansion_rate', 'saas_nrr'],
      },
      {
        stepNumber: 5,
        type: 'recommendation',
        description: 'Invest in guided onboarding automation and proactive health scoring to halve TTV.',
        kpiReferences: ['cust_time_to_value'],
      },
    ],
    qualityMetrics: { overallConfidence: 0.78, dataCompleteness: 0.85, benchmarkCoverage: 0.90 },
  },

  // --------------------------------------------------------------------------
  // 2. Operational efficiency — revenue per employee
  // --------------------------------------------------------------------------
  {
    traceId: 'vmrt-002-ops-efficiency',
    context: {
      organization: { industry: 'Software', size: 'enterprise', arr: 80_000_000 },
      persona: 'cfo',
    },
    valueModel: {
      outcomeCategory: 'efficiency_gain',
      financialImpact: {
        totalImpact: { amount: 8_000_000, currency: 'USD', timeframeMonths: 18 },
        recurring: true,
        confidenceLevel: 0.82,
      },
    },
    reasoningSteps: [
      {
        stepNumber: 1,
        type: 'observation',
        description: 'Revenue per employee is $200K (p25). Utilization rate is 65% versus 72% median. Operating margin is -5%.',
        kpiReferences: ['ops_revenue_per_employee', 'wf_utilization_rate', 'fin_operating_margin'],
      },
      {
        stepNumber: 2,
        type: 'hypothesis',
        description: 'Improving utilization to 78% should increase revenue per employee to $290K, driving operating margin to 8%.',
        kpiReferences: ['wf_utilization_rate', 'ops_revenue_per_employee', 'fin_operating_margin'],
      },
      {
        stepNumber: 3,
        type: 'evidence',
        description: 'ESO path: wf_utilization_rate → ops_revenue_per_employee (0.70) → fin_operating_margin (0.75). Combined effect weight 0.53.',
        kpiReferences: ['wf_utilization_rate', 'ops_revenue_per_employee', 'fin_operating_margin'],
      },
      {
        stepNumber: 4,
        type: 'quantification',
        description: 'Moving operating margin from -5% to 5% on $80M ARR saves $8M annually. 400-employee org gaining $90K per employee.',
        kpiReferences: ['fin_operating_margin', 'ops_revenue_per_employee'],
      },
      {
        stepNumber: 5,
        type: 'recommendation',
        description: 'Deploy resource planning automation and reduce context-switching through team topology redesign.',
        kpiReferences: ['wf_utilization_rate'],
      },
    ],
    qualityMetrics: { overallConfidence: 0.82, dataCompleteness: 0.90, benchmarkCoverage: 0.95 },
  },

  // --------------------------------------------------------------------------
  // 3. Sales efficiency — CAC reduction
  // --------------------------------------------------------------------------
  {
    traceId: 'vmrt-003-sales-efficiency',
    context: {
      organization: { industry: 'Software', size: 'mid_market', arr: 15_000_000 },
      persona: 'cro',
    },
    valueModel: {
      outcomeCategory: 'cost_reduction',
      financialImpact: {
        totalImpact: { amount: 2_100_000, currency: 'USD', timeframeMonths: 12 },
        recurring: true,
        confidenceLevel: 0.72,
      },
    },
    reasoningSteps: [
      {
        stepNumber: 1,
        type: 'observation',
        description: 'CAC is $22K (worse than p25). Sales efficiency is 0.35x. Magic number is 0.45x. LTV:CAC at 1.8x.',
        kpiReferences: ['saas_cac', 'growth_sales_efficiency', 'saas_magic_number', 'saas_ltv_cac'],
      },
      {
        stepNumber: 2,
        type: 'hypothesis',
        description: 'Improving sales efficiency to 0.7x through PLG motion and lead scoring should reduce CAC to $12K.',
        kpiReferences: ['growth_sales_efficiency', 'saas_cac'],
      },
      {
        stepNumber: 3,
        type: 'evidence',
        description: 'ESO edge growth_sales_efficiency → saas_cac inhibits at 0.85. CAC → LTV:CAC inhibits at 0.80.',
        kpiReferences: ['growth_sales_efficiency', 'saas_cac', 'saas_ltv_cac'],
      },
      {
        stepNumber: 4,
        type: 'quantification',
        description: 'At 200 new customers/year, saving $10K per customer = $2M. Improved magic number unlocks $100K in reinvestment capacity.',
        kpiReferences: ['saas_cac', 'saas_magic_number'],
      },
      {
        stepNumber: 5,
        type: 'recommendation',
        description: 'Implement product-led growth trial funnel and automated lead qualification to reduce sales cycle and CAC.',
        kpiReferences: ['growth_sales_efficiency', 'saas_cac'],
      },
    ],
    qualityMetrics: { overallConfidence: 0.72, dataCompleteness: 0.80, benchmarkCoverage: 0.85 },
  },

  // --------------------------------------------------------------------------
  // 4. DSO reduction — cash flow improvement
  // --------------------------------------------------------------------------
  {
    traceId: 'vmrt-004-dso-cash-flow',
    context: {
      organization: { industry: 'Manufacturing', size: 'enterprise', arr: 120_000_000 },
      persona: 'cfo',
    },
    valueModel: {
      outcomeCategory: 'efficiency_gain',
      financialImpact: {
        totalImpact: { amount: 4_800_000, currency: 'USD', timeframeMonths: 12 },
        recurring: false,
        confidenceLevel: 0.85,
      },
    },
    reasoningSteps: [
      {
        stepNumber: 1,
        type: 'observation',
        description: 'DSO is 58 days (worse than p25 of 55). At $120M revenue, each day of DSO represents $329K in working capital.',
        kpiReferences: ['fin_dso'],
      },
      {
        stepNumber: 2,
        type: 'hypothesis',
        description: 'Reducing DSO from 58 to 43 days (near median) frees approximately $4.8M in working capital.',
        kpiReferences: ['fin_dso', 'fin_burn_multiple'],
      },
      {
        stepNumber: 3,
        type: 'evidence',
        description: 'ESO edge fin_dso → fin_burn_multiple drives at 0.40 with 1-month lag. Industry peers at p50 achieve 42-day DSO.',
        kpiReferences: ['fin_dso', 'fin_burn_multiple'],
      },
      {
        stepNumber: 4,
        type: 'quantification',
        description: '15 fewer days × $329K/day = $4.8M one-time cash release. Ongoing benefit of reduced borrowing costs at ~$240K/year.',
        kpiReferences: ['fin_dso'],
      },
      {
        stepNumber: 5,
        type: 'recommendation',
        description: 'Implement automated invoicing, early-payment discounts, and AR aging alerts.',
        kpiReferences: ['fin_dso'],
      },
    ],
    qualityMetrics: { overallConfidence: 0.85, dataCompleteness: 0.92, benchmarkCoverage: 0.88 },
  },

  // --------------------------------------------------------------------------
  // 5. Churn reduction via NPS improvement
  // --------------------------------------------------------------------------
  {
    traceId: 'vmrt-005-churn-nps',
    context: {
      organization: { industry: 'Healthcare', size: 'mid_market', arr: 30_000_000 },
      persona: 'vp_cs',
    },
    valueModel: {
      outcomeCategory: 'risk_mitigation',
      financialImpact: {
        totalImpact: { amount: 2_400_000, currency: 'USD', timeframeMonths: 12 },
        recurring: true,
        confidenceLevel: 0.75,
      },
    },
    reasoningSteps: [
      {
        stepNumber: 1,
        type: 'observation',
        description: 'Gross churn is 14% ($4.2M ARR lost annually). NPS is 18, well below the p25 of 20.',
        kpiReferences: ['saas_gross_churn', 'cust_nps'],
      },
      {
        stepNumber: 2,
        type: 'hypothesis',
        description: 'Raising NPS from 18 to 42 (median) should reduce gross churn from 14% to 6%, saving $2.4M in retained ARR.',
        kpiReferences: ['cust_nps', 'saas_gross_churn'],
      },
      {
        stepNumber: 3,
        type: 'evidence',
        description: 'ESO edge cust_nps → saas_gross_churn inhibits at 0.70. Healthcare companies with NPS > 40 average 5-7% gross churn.',
        kpiReferences: ['cust_nps', 'saas_gross_churn'],
      },
      {
        stepNumber: 4,
        type: 'quantification',
        description: 'Reducing churn from 14% to 6% saves 8 percentage points × $30M = $2.4M retained ARR per year.',
        kpiReferences: ['saas_gross_churn', 'saas_nrr'],
      },
      {
        stepNumber: 5,
        type: 'recommendation',
        description: 'Launch quarterly business reviews, proactive health scoring, and executive sponsor program for strategic accounts.',
        kpiReferences: ['cust_nps', 'saas_gross_churn'],
      },
    ],
    qualityMetrics: { overallConfidence: 0.75, dataCompleteness: 0.82, benchmarkCoverage: 0.80 },
  },

  // --------------------------------------------------------------------------
  // 6. Rule of 40 optimization — growth/profitability balance
  // --------------------------------------------------------------------------
  {
    traceId: 'vmrt-006-rule-of-40',
    context: {
      organization: { industry: 'Financial Services', size: 'enterprise', arr: 60_000_000 },
      persona: 'ceo',
    },
    valueModel: {
      outcomeCategory: 'revenue_growth',
      financialImpact: {
        totalImpact: { amount: 12_000_000, currency: 'USD', timeframeMonths: 24 },
        recurring: true,
        confidenceLevel: 0.70,
      },
    },
    reasoningSteps: [
      {
        stepNumber: 1,
        type: 'observation',
        description: 'Rule of 40 score is 22 (growth 20% + margin 2%). Board target is 40+. Growth slowing, margin flat.',
        kpiReferences: ['fin_rule_of_40', 'growth_arr_growth', 'fin_operating_margin'],
      },
      {
        stepNumber: 2,
        type: 'hypothesis',
        description: 'Dual path: accelerate growth to 28% via NRR improvement while improving margin to 12% via operational efficiency.',
        kpiReferences: ['growth_arr_growth', 'fin_operating_margin', 'saas_nrr', 'ops_revenue_per_employee'],
      },
      {
        stepNumber: 3,
        type: 'evidence',
        description: 'ESO paths: saas_nrr → growth_arr_growth (0.70, 3mo lag) and ops_revenue_per_employee → fin_operating_margin (0.75).',
        kpiReferences: ['saas_nrr', 'growth_arr_growth', 'ops_revenue_per_employee', 'fin_operating_margin'],
      },
      {
        stepNumber: 4,
        type: 'quantification',
        description: 'Growing from $60M at 20% to 28% adds $4.8M incremental ARR. Margin improvement from 2% to 12% saves $6M. Combined: $12M over 24 months.',
        kpiReferences: ['fin_rule_of_40', 'growth_arr_growth', 'fin_operating_margin'],
      },
      {
        stepNumber: 5,
        type: 'recommendation',
        description: 'Pursue balanced strategy: customer success investment for NRR + operational automation for margin. Target Rule of 40 = 40 within 8 quarters.',
        kpiReferences: ['fin_rule_of_40'],
      },
    ],
    qualityMetrics: { overallConfidence: 0.70, dataCompleteness: 0.78, benchmarkCoverage: 0.85 },
  },
];
