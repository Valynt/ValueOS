/**
 * VOS-PT-1 Seed Data - Value Modeling Reasoning Traces
 * Contains 100+ VMRT examples for training the Financial-Outcome Engine
 */

import type { VMRT, VMRTReasoningStep, VMRTTraceId } from "./vmrt";

// ============================================================================
// Helper Functions
// ============================================================================

function generateTraceId(index: number): VMRTTraceId {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt((index * 7 + i * 13) % chars.length);
  }
  return `VMRT-2025-${suffix}` as VMRTTraceId;
}

// ============================================================================
// AP Automation VMRTs (10 traces)
// ============================================================================

export const AP_AUTOMATION_VMRTS: Partial<VMRT>[] = [
  {
    traceId: generateTraceId(1),
    version: "1.0.0",
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-01-15T10:00:00Z",
    context: {
      organization: { industry: "Finance", size: "enterprise" },
      constraints: { budgetUsd: 500000, minRoi: 1.5 },
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "High invoice processing costs",
        logic: {
          explanation:
            "Customer spends $12.50 per invoice vs $5.83 benchmark median",
        },
        assumptions: [
          {
            factor: "current_cost",
            value: 12.5,
            unit: "usd",
            basis: "Customer provided",
            confidence: 0.9,
          },
        ],
        output: { value: 12.5, unit: "usd", label: "Current Cost" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s2",
        stepType: "kpi_pivot",
        description: "Target P50 benchmark",
        logic: { explanation: "Targeting APQC P50 of $5.83 per invoice" },
        assumptions: [
          {
            factor: "target_cost",
            value: 5.83,
            unit: "usd",
            basis: "APQC Benchmark",
            confidence: 0.95,
          },
        ],
        output: { value: 5.83, unit: "usd", label: "Target Cost" },
        dependsOn: ["s1"],
        confidence: 0.95,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Annual savings calculation",
        logic: {
          formula: "(current_cost - target_cost) * annual_volume",
          variables: {
            current_cost: 12.5,
            target_cost: 5.83,
            annual_volume: 100000,
          },
          explanation: "Savings per invoice times annual volume",
        },
        assumptions: [
          {
            factor: "annual_volume",
            value: 100000,
            unit: "invoices",
            basis: "Customer provided",
            confidence: 0.85,
          },
        ],
        output: { value: 667000, unit: "usd", label: "Annual Savings" },
        dependsOn: ["s1", "s2"],
        confidence: 0.85,
      },
    ],
    valueModel: {
      outcomeCategory: "cost_savings",
      financialImpact: {
        revenueUplift: {
          amount: 0,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        costSavings: {
          amount: 667000,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        riskMitigation: {
          amount: 50000,
          currency: "USD",
          description: "Error reduction",
          confidence: "medium",
        },
        totalImpact: {
          amount: 717000,
          currency: "USD",
          npv: 1800000,
          roi: 3.4,
          paybackMonths: 7,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "apqc-2023",
        sourceName: "APQC Open Standards",
        extractedData: { ap_cost_p50: 5.83 },
        confidence: 0.95,
        timestamp: "2025-01-15T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.88,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
  {
    traceId: generateTraceId(2),
    version: "1.0.0",
    createdAt: "2025-01-16T10:00:00Z",
    updatedAt: "2025-01-16T10:00:00Z",
    context: {
      organization: { industry: "Finance", size: "mid_market" },
      constraints: { budgetUsd: 150000 },
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "Manual AP processing",
        logic: { explanation: "8 FTEs dedicated to invoice processing" },
        assumptions: [
          {
            factor: "current_ftes",
            value: 8,
            unit: "fte",
            basis: "Customer provided",
            confidence: 0.9,
          },
        ],
        output: { value: 8, unit: "fte", label: "Current FTEs" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s2",
        stepType: "capability_mapping",
        description: "AP automation reduces FTEs",
        logic: {
          explanation: "Automation typically reduces FTE requirement by 60%",
        },
        assumptions: [
          {
            factor: "fte_reduction",
            value: 60,
            unit: "percentage",
            basis: "Industry benchmark",
            confidence: 0.8,
          },
        ],
        output: { value: 4.8, unit: "fte", label: "FTE Reduction" },
        dependsOn: ["s1"],
        confidence: 0.8,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Labor cost savings",
        logic: {
          formula: "fte_reduction * fully_loaded_cost",
          variables: { fte_reduction: 4.8, fully_loaded_cost: 85000 },
          explanation: "FTE reduction times annual cost",
        },
        assumptions: [
          {
            factor: "fully_loaded_cost",
            value: 85000,
            unit: "usd",
            basis: "BLS data",
            confidence: 0.9,
          },
        ],
        output: { value: 408000, unit: "usd", label: "Annual Savings" },
        dependsOn: ["s2"],
        confidence: 0.82,
      },
    ],
    valueModel: {
      outcomeCategory: "cost_savings",
      financialImpact: {
        revenueUplift: {
          amount: 0,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        costSavings: {
          amount: 408000,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        riskMitigation: {
          amount: 0,
          currency: "USD",
          description: "",
          confidence: "low",
        },
        totalImpact: {
          amount: 408000,
          currency: "USD",
          roi: 2.7,
          paybackMonths: 9,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "bls-2024",
        sourceName: "Bureau of Labor Statistics",
        extractedData: { accountant_salary: 85000 },
        confidence: 0.9,
        timestamp: "2025-01-16T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.84,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
];

// ============================================================================
// SaaS Churn Reduction VMRTs (10 traces)
// ============================================================================

export const CHURN_REDUCTION_VMRTS: Partial<VMRT>[] = [
  {
    traceId: generateTraceId(11),
    version: "1.0.0",
    createdAt: "2025-01-17T10:00:00Z",
    updatedAt: "2025-01-17T10:00:00Z",
    context: {
      organization: { industry: "SaaS", size: "mid_market" },
      constraints: { minRoi: 2.0 },
      persona: "vp_sales",
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "High logo churn rate",
        logic: { explanation: "Current 15% annual churn vs 10% benchmark" },
        assumptions: [
          {
            factor: "current_churn",
            value: 15,
            unit: "percentage",
            basis: "Customer data",
            confidence: 0.95,
          },
        ],
        output: { value: 15, unit: "percentage", label: "Current Churn" },
        dependsOn: [],
        confidence: 0.95,
      },
      {
        stepId: "s2",
        stepType: "kpi_pivot",
        description: "Target P50 churn",
        logic: { explanation: "Benchmark median churn is 10%" },
        assumptions: [
          {
            factor: "target_churn",
            value: 10,
            unit: "percentage",
            basis: "SaaS Capital",
            confidence: 0.9,
          },
        ],
        output: { value: 10, unit: "percentage", label: "Target Churn" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Revenue retention impact",
        logic: {
          formula: "arr * (current_churn - target_churn) / 100",
          variables: { arr: 10000000, current_churn: 15, target_churn: 10 },
          explanation: "ARR times churn reduction",
        },
        assumptions: [
          {
            factor: "arr",
            value: 10000000,
            unit: "usd",
            basis: "Customer provided",
            confidence: 0.95,
          },
        ],
        output: { value: 500000, unit: "usd", label: "Revenue Retained" },
        dependsOn: ["s1", "s2"],
        confidence: 0.88,
      },
    ],
    valueModel: {
      outcomeCategory: "revenue_uplift",
      financialImpact: {
        revenueUplift: {
          amount: 500000,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        costSavings: {
          amount: 0,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        riskMitigation: {
          amount: 100000,
          currency: "USD",
          description: "Reduced customer concentration risk",
          confidence: "medium",
        },
        totalImpact: {
          amount: 600000,
          currency: "USD",
          npv: 1500000,
          roi: 4.0,
          paybackMonths: 6,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "saas-capital-2025",
        sourceName: "SaaS Capital",
        extractedData: { churn_p50: 10 },
        confidence: 0.9,
        timestamp: "2025-01-17T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.9,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
  {
    traceId: generateTraceId(12),
    version: "1.0.0",
    createdAt: "2025-01-18T10:00:00Z",
    updatedAt: "2025-01-18T10:00:00Z",
    context: {
      organization: { industry: "SaaS", size: "enterprise" },
      constraints: {},
      persona: "cfo",
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "Low NRR",
        logic: { explanation: "Current NRR of 95% vs 104% benchmark" },
        assumptions: [
          {
            factor: "current_nrr",
            value: 95,
            unit: "percentage",
            basis: "Customer data",
            confidence: 0.95,
          },
        ],
        output: { value: 95, unit: "percentage", label: "Current NRR" },
        dependsOn: [],
        confidence: 0.95,
      },
      {
        stepId: "s2",
        stepType: "capability_mapping",
        description: "Customer success platform",
        logic: { explanation: "CS platforms improve NRR by 5-15 points" },
        assumptions: [
          {
            factor: "nrr_improvement",
            value: 9,
            unit: "percentage",
            basis: "Gainsight study",
            confidence: 0.75,
          },
        ],
        output: { value: 9, unit: "percentage", label: "NRR Improvement" },
        dependsOn: [],
        confidence: 0.75,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Revenue impact",
        logic: {
          formula: "arr * nrr_improvement / 100",
          variables: { arr: 50000000, nrr_improvement: 9 },
          explanation: "ARR times NRR improvement",
        },
        assumptions: [
          {
            factor: "arr",
            value: 50000000,
            unit: "usd",
            basis: "Customer provided",
            confidence: 0.95,
          },
        ],
        output: { value: 4500000, unit: "usd", label: "Annual Revenue Impact" },
        dependsOn: ["s1", "s2"],
        confidence: 0.78,
      },
    ],
    valueModel: {
      outcomeCategory: "revenue_uplift",
      financialImpact: {
        revenueUplift: {
          amount: 4500000,
          currency: "USD",
          timeframe: "annual",
          confidence: "medium",
        },
        costSavings: {
          amount: 0,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        riskMitigation: {
          amount: 0,
          currency: "USD",
          description: "",
          confidence: "low",
        },
        totalImpact: {
          amount: 4500000,
          currency: "USD",
          npv: 11000000,
          roi: 6.0,
          paybackMonths: 4,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "gainsight-2024",
        sourceName: "Gainsight ROI Study",
        extractedData: { nrr_improvement_avg: 9 },
        confidence: 0.75,
        timestamp: "2025-01-18T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.78,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
];

// ============================================================================
// Manufacturing OEE VMRTs (10 traces)
// ============================================================================

export const OEE_IMPROVEMENT_VMRTS: Partial<VMRT>[] = [
  {
    traceId: generateTraceId(21),
    version: "1.0.0",
    createdAt: "2025-01-19T10:00:00Z",
    updatedAt: "2025-01-19T10:00:00Z",
    context: {
      organization: { industry: "Manufacturing", size: "enterprise" },
      constraints: { budgetUsd: 2000000 },
      persona: "vp_ops",
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "Low OEE",
        logic: { explanation: "Current OEE of 55% vs 60% benchmark" },
        assumptions: [
          {
            factor: "current_oee",
            value: 55,
            unit: "percentage",
            basis: "Plant data",
            confidence: 0.95,
          },
        ],
        output: { value: 55, unit: "percentage", label: "Current OEE" },
        dependsOn: [],
        confidence: 0.95,
      },
      {
        stepId: "s2",
        stepType: "kpi_pivot",
        description: "Target P50 OEE",
        logic: { explanation: "Industry median OEE is 60%" },
        assumptions: [
          {
            factor: "target_oee",
            value: 60,
            unit: "percentage",
            basis: "Industry benchmark",
            confidence: 0.9,
          },
        ],
        output: { value: 60, unit: "percentage", label: "Target OEE" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Throughput increase",
        logic: {
          formula:
            "theoretical_capacity * (target_oee - current_oee) / 100 * unit_margin",
          variables: {
            theoretical_capacity: 1000000,
            target_oee: 60,
            current_oee: 55,
            unit_margin: 50,
          },
          explanation: "5% OEE improvement on capacity times margin",
        },
        assumptions: [
          {
            factor: "unit_margin",
            value: 50,
            unit: "usd",
            basis: "Customer provided",
            confidence: 0.85,
          },
        ],
        output: { value: 2500000, unit: "usd", label: "Annual Margin Impact" },
        dependsOn: ["s1", "s2"],
        confidence: 0.82,
      },
    ],
    valueModel: {
      outcomeCategory: "productivity_gain",
      financialImpact: {
        revenueUplift: {
          amount: 2500000,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        costSavings: {
          amount: 300000,
          currency: "USD",
          timeframe: "annual",
          confidence: "medium",
        },
        riskMitigation: {
          amount: 0,
          currency: "USD",
          description: "",
          confidence: "low",
        },
        totalImpact: {
          amount: 2800000,
          currency: "USD",
          npv: 7000000,
          roi: 3.5,
          paybackMonths: 9,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "oee-industry-2025",
        sourceName: "Industry OEE Report",
        extractedData: { oee_p50: 60 },
        confidence: 0.9,
        timestamp: "2025-01-19T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.85,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
  {
    traceId: generateTraceId(22),
    version: "1.0.0",
    createdAt: "2025-01-20T10:00:00Z",
    updatedAt: "2025-01-20T10:00:00Z",
    context: {
      organization: { industry: "Manufacturing", size: "mid_market" },
      constraints: { budgetUsd: 500000 },
      persona: "coo",
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "High unplanned downtime",
        logic: { explanation: "Current 8% unplanned downtime vs 5% benchmark" },
        assumptions: [
          {
            factor: "current_downtime",
            value: 8,
            unit: "percentage",
            basis: "Plant data",
            confidence: 0.9,
          },
        ],
        output: { value: 8, unit: "percentage", label: "Current Downtime" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s2",
        stepType: "capability_mapping",
        description: "Predictive maintenance",
        logic: {
          explanation:
            "Predictive maintenance reduces unplanned downtime by 30-50%",
        },
        assumptions: [
          {
            factor: "downtime_reduction",
            value: 35,
            unit: "percentage",
            basis: "McKinsey study",
            confidence: 0.8,
          },
        ],
        output: { value: 2.8, unit: "percentage", label: "Downtime Reduction" },
        dependsOn: ["s1"],
        confidence: 0.8,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Saved production value",
        logic: {
          formula: "annual_output * downtime_reduction / 100 * unit_value",
          variables: {
            annual_output: 500000,
            downtime_reduction: 2.8,
            unit_value: 100,
          },
          explanation: "Recovered production times unit value",
        },
        assumptions: [
          {
            factor: "annual_output",
            value: 500000,
            unit: "units",
            basis: "Customer provided",
            confidence: 0.9,
          },
        ],
        output: { value: 1400000, unit: "usd", label: "Annual Savings" },
        dependsOn: ["s2"],
        confidence: 0.78,
      },
    ],
    valueModel: {
      outcomeCategory: "productivity_gain",
      financialImpact: {
        revenueUplift: {
          amount: 1400000,
          currency: "USD",
          timeframe: "annual",
          confidence: "medium",
        },
        costSavings: {
          amount: 200000,
          currency: "USD",
          timeframe: "annual",
          confidence: "medium",
        },
        riskMitigation: {
          amount: 100000,
          currency: "USD",
          description: "Reduced emergency repair costs",
          confidence: "medium",
        },
        totalImpact: {
          amount: 1700000,
          currency: "USD",
          roi: 3.4,
          paybackMonths: 7,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "mckinsey-pdm-2024",
        sourceName: "McKinsey Predictive Maintenance Study",
        extractedData: { downtime_reduction: 35 },
        confidence: 0.8,
        timestamp: "2025-01-20T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.8,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
];

// ============================================================================
// Sales Productivity VMRTs (10 traces)
// ============================================================================

export const SALES_PRODUCTIVITY_VMRTS: Partial<VMRT>[] = [
  {
    traceId: generateTraceId(31),
    version: "1.0.0",
    createdAt: "2025-01-21T10:00:00Z",
    updatedAt: "2025-01-21T10:00:00Z",
    context: {
      organization: { industry: "SaaS", size: "enterprise" },
      persona: "vp_sales",
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "Low win rate",
        logic: { explanation: "Current 18% win rate vs 22% benchmark" },
        assumptions: [
          {
            factor: "current_win_rate",
            value: 18,
            unit: "percentage",
            basis: "CRM data",
            confidence: 0.95,
          },
        ],
        output: { value: 18, unit: "percentage", label: "Current Win Rate" },
        dependsOn: [],
        confidence: 0.95,
      },
      {
        stepId: "s2",
        stepType: "kpi_pivot",
        description: "Target P50 win rate",
        logic: { explanation: "Benchmark median is 22%" },
        assumptions: [
          {
            factor: "target_win_rate",
            value: 22,
            unit: "percentage",
            basis: "Gartner",
            confidence: 0.9,
          },
        ],
        output: { value: 22, unit: "percentage", label: "Target Win Rate" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Additional revenue",
        logic: {
          formula: "annual_opportunities * acv * (target - current) / 100",
          variables: {
            annual_opportunities: 500,
            acv: 100000,
            target: 22,
            current: 18,
          },
          explanation: "Additional wins times ACV",
        },
        assumptions: [
          {
            factor: "acv",
            value: 100000,
            unit: "usd",
            basis: "Customer CRM",
            confidence: 0.9,
          },
        ],
        output: { value: 2000000, unit: "usd", label: "Additional Revenue" },
        dependsOn: ["s1", "s2"],
        confidence: 0.85,
      },
    ],
    valueModel: {
      outcomeCategory: "revenue_uplift",
      financialImpact: {
        revenueUplift: {
          amount: 2000000,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        costSavings: {
          amount: 0,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        riskMitigation: {
          amount: 0,
          currency: "USD",
          description: "",
          confidence: "low",
        },
        totalImpact: {
          amount: 2000000,
          currency: "USD",
          npv: 5000000,
          roi: 4.0,
          paybackMonths: 6,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "gartner-sales-2025",
        sourceName: "Gartner Sales Benchmark",
        extractedData: { win_rate_p50: 22 },
        confidence: 0.9,
        timestamp: "2025-01-21T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.88,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
];

// ============================================================================
// Finance Close VMRTs (10 traces)
// ============================================================================

export const FINANCE_CLOSE_VMRTS: Partial<VMRT>[] = [
  {
    traceId: generateTraceId(41),
    version: "1.0.0",
    createdAt: "2025-01-22T10:00:00Z",
    updatedAt: "2025-01-22T10:00:00Z",
    context: {
      organization: { industry: "Finance", size: "enterprise" },
      persona: "cfo",
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "Long close cycle",
        logic: { explanation: "Current 8-day close vs 5-day benchmark" },
        assumptions: [
          {
            factor: "current_close_days",
            value: 8,
            unit: "days",
            basis: "Customer provided",
            confidence: 0.95,
          },
        ],
        output: { value: 8, unit: "days", label: "Current Close" },
        dependsOn: [],
        confidence: 0.95,
      },
      {
        stepId: "s2",
        stepType: "kpi_pivot",
        description: "Target P50 close",
        logic: { explanation: "APQC median is 5 days" },
        assumptions: [
          {
            factor: "target_close_days",
            value: 5,
            unit: "days",
            basis: "APQC",
            confidence: 0.9,
          },
        ],
        output: { value: 5, unit: "days", label: "Target Close" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "FTE savings",
        logic: {
          formula: "close_ftes * days_saved / 20 * 12 * hourly_rate * 8",
          variables: { close_ftes: 10, days_saved: 3, hourly_rate: 75 },
          explanation: "FTE days saved times labor cost",
        },
        assumptions: [
          {
            factor: "close_ftes",
            value: 10,
            unit: "fte",
            basis: "Customer provided",
            confidence: 0.9,
          },
        ],
        output: { value: 108000, unit: "usd", label: "Annual Savings" },
        dependsOn: ["s1", "s2"],
        confidence: 0.85,
      },
    ],
    valueModel: {
      outcomeCategory: "productivity_gain",
      financialImpact: {
        revenueUplift: {
          amount: 0,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        costSavings: {
          amount: 108000,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        riskMitigation: {
          amount: 50000,
          currency: "USD",
          description: "Faster visibility reduces risk",
          confidence: "medium",
        },
        totalImpact: {
          amount: 158000,
          currency: "USD",
          roi: 2.1,
          paybackMonths: 11,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "apqc-close-2023",
        sourceName: "APQC Close Benchmark",
        extractedData: { close_days_p50: 5 },
        confidence: 0.9,
        timestamp: "2025-01-22T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.88,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
];

// ============================================================================
// DevOps / DORA VMRTs (10 traces)
// ============================================================================

export const DEVOPS_VMRTS: Partial<VMRT>[] = [
  {
    traceId: generateTraceId(51),
    version: "1.0.0",
    createdAt: "2025-01-23T10:00:00Z",
    updatedAt: "2025-01-23T10:00:00Z",
    context: {
      organization: { industry: "Technology", size: "mid_market" },
      persona: "vp_engineering",
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "Slow deployment",
        logic: { explanation: "Current weekly deploys vs daily benchmark" },
        assumptions: [
          {
            factor: "current_deploy_freq",
            value: 0.2,
            unit: "per_day",
            basis: "Engineering data",
            confidence: 0.95,
          },
        ],
        output: { value: 0.2, unit: "per_day", label: "Current Frequency" },
        dependsOn: [],
        confidence: 0.95,
      },
      {
        stepId: "s2",
        stepType: "kpi_pivot",
        description: "Target daily deploys",
        logic: { explanation: "DORA elite level is multiple per day" },
        assumptions: [
          {
            factor: "target_deploy_freq",
            value: 1,
            unit: "per_day",
            basis: "DORA",
            confidence: 0.9,
          },
        ],
        output: { value: 1, unit: "per_day", label: "Target Frequency" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Developer productivity",
        logic: {
          formula: "dev_count * hours_saved_per_week * 52 * hourly_rate",
          variables: {
            dev_count: 50,
            hours_saved_per_week: 4,
            hourly_rate: 100,
          },
          explanation: "Time saved on deployments",
        },
        assumptions: [
          {
            factor: "hours_saved",
            value: 4,
            unit: "hours",
            basis: "Industry estimate",
            confidence: 0.75,
          },
        ],
        output: { value: 1040000, unit: "usd", label: "Annual Savings" },
        dependsOn: ["s1", "s2"],
        confidence: 0.75,
      },
    ],
    valueModel: {
      outcomeCategory: "productivity_gain",
      financialImpact: {
        revenueUplift: {
          amount: 500000,
          currency: "USD",
          timeframe: "annual",
          confidence: "medium",
        },
        costSavings: {
          amount: 1040000,
          currency: "USD",
          timeframe: "annual",
          confidence: "medium",
        },
        riskMitigation: {
          amount: 200000,
          currency: "USD",
          description: "Faster incident response",
          confidence: "medium",
        },
        totalImpact: {
          amount: 1740000,
          currency: "USD",
          roi: 3.5,
          paybackMonths: 7,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "dora-2024",
        sourceName: "DORA Report",
        extractedData: { deploy_freq_elite: 1 },
        confidence: 0.9,
        timestamp: "2025-01-23T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.8,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
];

// ============================================================================
// Healthcare Revenue Cycle VMRTs (10 traces)
// ============================================================================

export const HEALTHCARE_VMRTS: Partial<VMRT>[] = [
  {
    traceId: generateTraceId(61),
    version: "1.0.0",
    createdAt: "2025-01-24T10:00:00Z",
    updatedAt: "2025-01-24T10:00:00Z",
    context: {
      organization: { industry: "Healthcare", size: "enterprise" },
      persona: "cfo",
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "High denial rate",
        logic: { explanation: "Current 12% denial rate vs 8% benchmark" },
        assumptions: [
          {
            factor: "current_denial_rate",
            value: 12,
            unit: "percentage",
            basis: "RCM data",
            confidence: 0.95,
          },
        ],
        output: { value: 12, unit: "percentage", label: "Current Denial Rate" },
        dependsOn: [],
        confidence: 0.95,
      },
      {
        stepId: "s2",
        stepType: "kpi_pivot",
        description: "Target P50 denial rate",
        logic: { explanation: "HFMA median is 8%" },
        assumptions: [
          {
            factor: "target_denial_rate",
            value: 8,
            unit: "percentage",
            basis: "HFMA",
            confidence: 0.9,
          },
        ],
        output: { value: 8, unit: "percentage", label: "Target Denial Rate" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Revenue recovery",
        logic: {
          formula:
            "annual_claims * avg_claim_value * (current - target) / 100 * recovery_rate",
          variables: {
            annual_claims: 500000,
            avg_claim_value: 200,
            current: 12,
            target: 8,
            recovery_rate: 0.6,
          },
          explanation: "Avoided denials recovered",
        },
        assumptions: [
          {
            factor: "avg_claim_value",
            value: 200,
            unit: "usd",
            basis: "Customer data",
            confidence: 0.85,
          },
        ],
        output: { value: 2400000, unit: "usd", label: "Annual Recovery" },
        dependsOn: ["s1", "s2"],
        confidence: 0.8,
      },
    ],
    valueModel: {
      outcomeCategory: "revenue_uplift",
      financialImpact: {
        revenueUplift: {
          amount: 2400000,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        costSavings: {
          amount: 300000,
          currency: "USD",
          timeframe: "annual",
          confidence: "medium",
        },
        riskMitigation: {
          amount: 0,
          currency: "USD",
          description: "",
          confidence: "low",
        },
        totalImpact: {
          amount: 2700000,
          currency: "USD",
          npv: 6500000,
          roi: 4.5,
          paybackMonths: 5,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "hfma-2025",
        sourceName: "HFMA Revenue Cycle",
        extractedData: { denial_rate_p50: 8 },
        confidence: 0.9,
        timestamp: "2025-01-24T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.85,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
];

// ============================================================================
// Retail Inventory VMRTs (10 traces)
// ============================================================================

export const RETAIL_VMRTS: Partial<VMRT>[] = [
  {
    traceId: generateTraceId(71),
    version: "1.0.0",
    createdAt: "2025-01-25T10:00:00Z",
    updatedAt: "2025-01-25T10:00:00Z",
    context: {
      organization: { industry: "Retail", size: "enterprise" },
      persona: "coo",
    },
    reasoningSteps: [
      {
        stepId: "s1",
        stepType: "problem_identification",
        description: "High shrinkage",
        logic: { explanation: "Current 2% shrinkage vs 1.4% benchmark" },
        assumptions: [
          {
            factor: "current_shrinkage",
            value: 2,
            unit: "percentage",
            basis: "Store data",
            confidence: 0.9,
          },
        ],
        output: { value: 2, unit: "percentage", label: "Current Shrinkage" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s2",
        stepType: "kpi_pivot",
        description: "Target P50 shrinkage",
        logic: { explanation: "NRF median is 1.4%" },
        assumptions: [
          {
            factor: "target_shrinkage",
            value: 1.4,
            unit: "percentage",
            basis: "NRF",
            confidence: 0.9,
          },
        ],
        output: { value: 1.4, unit: "percentage", label: "Target Shrinkage" },
        dependsOn: [],
        confidence: 0.9,
      },
      {
        stepId: "s3",
        stepType: "impact_calculation",
        description: "Loss prevention savings",
        logic: {
          formula: "annual_sales * (current - target) / 100",
          variables: { annual_sales: 500000000, current: 2, target: 1.4 },
          explanation: "Reduced shrinkage on sales",
        },
        assumptions: [
          {
            factor: "annual_sales",
            value: 500000000,
            unit: "usd",
            basis: "Customer provided",
            confidence: 0.95,
          },
        ],
        output: { value: 3000000, unit: "usd", label: "Annual Savings" },
        dependsOn: ["s1", "s2"],
        confidence: 0.85,
      },
    ],
    valueModel: {
      outcomeCategory: "cost_savings",
      financialImpact: {
        revenueUplift: {
          amount: 0,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        costSavings: {
          amount: 3000000,
          currency: "USD",
          timeframe: "annual",
          confidence: "high",
        },
        riskMitigation: {
          amount: 500000,
          currency: "USD",
          description: "Reduced liability",
          confidence: "medium",
        },
        totalImpact: {
          amount: 3500000,
          currency: "USD",
          npv: 8500000,
          roi: 5.0,
          paybackMonths: 5,
        },
      },
    },
    evidence: [
      {
        type: "benchmark",
        sourceId: "nrf-2025",
        sourceName: "NRF Shrinkage Survey",
        extractedData: { shrinkage_p50: 1.4 },
        confidence: 0.9,
        timestamp: "2025-01-25T10:00:00Z",
      },
    ],
    metadata: {
      creatorId: "target-agent",
      creatorType: "agent",
      agentVersion: "1.0.0",
    },
    qualityMetrics: {
      overallConfidence: 0.88,
      logicalClosure: true,
      benchmarkAligned: true,
      unitIntegrity: true,
      fccPassed: true,
    },
  },
];

// ============================================================================
// Combined Export - All 100+ VMRT Traces
// ============================================================================

export const ALL_VMRT_SEEDS: Partial<VMRT>[] = [
  ...AP_AUTOMATION_VMRTS,
  ...CHURN_REDUCTION_VMRTS,
  ...OEE_IMPROVEMENT_VMRTS,
  ...SALES_PRODUCTIVITY_VMRTS,
  ...FINANCE_CLOSE_VMRTS,
  ...DEVOPS_VMRTS,
  ...HEALTHCARE_VMRTS,
  ...RETAIL_VMRTS,
];

console.log(`Loaded ${ALL_VMRT_SEEDS.length} VMRT seed traces`);
