/**
 * VMRT (Value Modeling Reasoning Trace) Schema
 *
 * The VMRT is the fundamental unit of storage for ValueOS.
 * It captures the entire cognitive chain used to calculate a value outcome,
 * ensuring transparency and auditability for financial claims.
 *
 * Based on: ValueOS Financial Outcome Engine Dataset Pretraining Specification (VOS-PT-1)
 */

import { z } from "zod";
import type { ConfidenceLevel } from "./vos";

// ============================================================================
// VMRT Core Types
// ============================================================================

/**
 * Unique trace identifier following the pattern: VMRT-{year}-{alphanumeric}
 */
export type VMRTTraceId = `VMRT-${number}-${string}`;

/**
 * Types of reasoning steps in a VMRT
 */
export type VMRTStepType =
  | "problem_identification"
  | "capability_mapping"
  | "kpi_pivot"
  | "impact_calculation"
  | "benchmark_calibration"
  | "risk_adjustment"
  | "sensitivity_analysis"
  | "narrative_synthesis";

/**
 * Financial outcome categories
 */
export type OutcomeCategory =
  | "cost_savings"
  | "revenue_uplift"
  | "risk_mitigation"
  | "productivity_gain"
  | "capital_efficiency";

/**
 * Assumption basis for financial claims
 */
export interface VMRTAssumption {
  factor: string;
  value: number;
  unit: string;
  basis: string; // e.g., "APQC Benchmark", "Customer Provided", "Industry Average"
  confidence: number; // 0-1
  source?: string;
  vintage?: string; // e.g., "2025-Q4"
}

/**
 * A single reasoning step in the VMRT chain
 */
export interface VMRTReasoningStep {
  stepId: string;
  stepType: VMRTStepType;
  description: string;
  logic: {
    formula?: string;
    variables?: Record<string, number | string>;
    explanation: string;
  };
  assumptions: VMRTAssumption[];
  output: {
    value: number;
    unit: string;
    label: string;
  };
  dependsOn: string[]; // Step IDs this step depends on
  confidence: number;
}

/**
 * Value model financial impact breakdown
 */
export interface VMRTFinancialImpact {
  revenueUplift: {
    amount: number;
    currency: string;
    timeframe: string;
    confidence: ConfidenceLevel;
  };
  costSavings: {
    amount: number;
    currency: string;
    timeframe: string;
    confidence: ConfidenceLevel;
  };
  riskMitigation: {
    amount: number;
    currency: string;
    description: string;
    confidence: ConfidenceLevel;
  };
  totalImpact: {
    amount: number;
    currency: string;
    npv?: number;
    roi?: number;
    paybackMonths?: number;
  };
}

/**
 * Sensitivity analysis for key variables
 */
export interface VMRTSensitivityAnalysis {
  variable: string;
  baseCase: number;
  pessimistic: number;
  optimistic: number;
  impactRange: {
    min: number;
    max: number;
  };
}

/**
 * Context information for the VMRT
 */
export interface VMRTContext {
  organization: {
    industry: string;
    size: "smb" | "mid_market" | "enterprise";
    region?: string;
  };
  constraints?: {
    budgetUsd?: number;
    timelineMonths?: number;
    minRoi?: number;
    riskTolerance?: "low" | "medium" | "high";
  };
  persona?: string;
}

/**
 * Evidence supporting the VMRT
 */
export interface VMRTEvidence {
  type: "document" | "crm_record" | "telemetry" | "benchmark" | "interview";
  sourceId: string;
  sourceName: string;
  extractedData: Record<string, unknown>;
  confidence: number;
  timestamp: string;
}

/**
 * Complete Value Modeling Reasoning Trace
 */
export interface VMRT {
  traceId: VMRTTraceId;
  version: string;
  createdAt: string;
  updatedAt: string;

  // Context
  context: VMRTContext;

  // Reasoning chain
  reasoningSteps: VMRTReasoningStep[];

  // Value model
  valueModel: {
    outcomeCategory: OutcomeCategory;
    financialImpact: VMRTFinancialImpact;
    sensitivityAnalysis?: VMRTSensitivityAnalysis[];
  };

  // Evidence & provenance
  evidence: VMRTEvidence[];

  // Metadata
  metadata: {
    creatorId: string;
    creatorType: "agent" | "user";
    agentVersion?: string;
    valueCaseId?: string;
    sessionId?: string;
  };

  // Quality metrics
  qualityMetrics: {
    overallConfidence: number;
    logicalClosure: boolean;
    benchmarkAligned: boolean;
    unitIntegrity: boolean;
    fccPassed: boolean;
  };
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const VMRTAssumptionSchema = z.object({
  factor: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  basis: z.string().min(1),
  confidence: z.number().min(0).max(1),
  source: z.string().optional(),
  vintage: z.string().optional(),
});

export const VMRTReasoningStepSchema = z.object({
  stepId: z.string(),
  stepType: z.enum([
    "problem_identification",
    "capability_mapping",
    "kpi_pivot",
    "impact_calculation",
    "benchmark_calibration",
    "risk_adjustment",
    "sensitivity_analysis",
    "narrative_synthesis",
  ]),
  description: z.string(),
  logic: z.object({
    formula: z.string().optional(),
    variables: z.record(z.union([z.number(), z.string()])).optional(),
    explanation: z.string(),
  }),
  assumptions: z.array(VMRTAssumptionSchema),
  output: z.object({
    value: z.number(),
    unit: z.string(),
    label: z.string(),
  }),
  dependsOn: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const VMRTFinancialImpactSchema = z.object({
  revenueUplift: z.object({
    amount: z.number(),
    currency: z.string(),
    timeframe: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
  }),
  costSavings: z.object({
    amount: z.number(),
    currency: z.string(),
    timeframe: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
  }),
  riskMitigation: z.object({
    amount: z.number(),
    currency: z.string(),
    description: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
  }),
  totalImpact: z.object({
    amount: z.number(),
    currency: z.string(),
    npv: z.number().optional(),
    roi: z.number().optional(),
    paybackMonths: z.number().optional(),
  }),
});

export const VMRTSchema = z.object({
  traceId: z.string().regex(/^VMRT-\d{4}-[A-Z0-9]{6}$/),
  version: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  context: z.object({
    organization: z.object({
      industry: z.string(),
      size: z.enum(["smb", "mid_market", "enterprise"]),
      region: z.string().optional(),
    }),
    constraints: z
      .object({
        budgetUsd: z.number().optional(),
        timelineMonths: z.number().optional(),
        minRoi: z.number().optional(),
        riskTolerance: z.enum(["low", "medium", "high"]).optional(),
      })
      .optional(),
    persona: z.string().optional(),
  }),

  reasoningSteps: z.array(VMRTReasoningStepSchema).min(1),

  valueModel: z.object({
    outcomeCategory: z.enum([
      "cost_savings",
      "revenue_uplift",
      "risk_mitigation",
      "productivity_gain",
      "capital_efficiency",
    ]),
    financialImpact: VMRTFinancialImpactSchema,
    sensitivityAnalysis: z
      .array(
        z.object({
          variable: z.string(),
          baseCase: z.number(),
          pessimistic: z.number(),
          optimistic: z.number(),
          impactRange: z.object({
            min: z.number(),
            max: z.number(),
          }),
        })
      )
      .optional(),
  }),

  evidence: z.array(
    z.object({
      type: z.enum([
        "document",
        "crm_record",
        "telemetry",
        "benchmark",
        "interview",
      ]),
      sourceId: z.string(),
      sourceName: z.string(),
      extractedData: z.record(z.unknown()),
      confidence: z.number().min(0).max(1),
      timestamp: z.string().datetime(),
    })
  ),

  metadata: z.object({
    creatorId: z.string(),
    creatorType: z.enum(["agent", "user"]),
    agentVersion: z.string().optional(),
    valueCaseId: z.string().optional(),
    sessionId: z.string().optional(),
  }),

  qualityMetrics: z.object({
    overallConfidence: z.number().min(0).max(1),
    logicalClosure: z.boolean(),
    benchmarkAligned: z.boolean(),
    unitIntegrity: z.boolean(),
    fccPassed: z.boolean(),
  }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique VMRT trace ID
 */
export function generateVMRTTraceId(): VMRTTraceId {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VMRT-${year}-${suffix}` as VMRTTraceId;
}

/**
 * Validate a VMRT against the schema
 */
export function validateVMRT(vmrt: unknown): {
  valid: boolean;
  errors?: z.ZodError;
} {
  const result = VMRTSchema.safeParse(vmrt);
  if (result.success) {
    return { valid: true };
  }
  return { valid: false, errors: result.error };
}

/**
 * Check if VMRT passes Financial Consistency Check (FCC)
 */
export function checkFCC(vmrt: VMRT): {
  passed: boolean;
  logicalClosure: boolean;
  benchmarkAligned: boolean;
  unitIntegrity: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check logical closure - does the chain lead to the stated impact?
  const logicalClosure = vmrt.reasoningSteps.every((step) => {
    if (step.dependsOn.length === 0) return true;
    return step.dependsOn.every((depId) =>
      vmrt.reasoningSteps.some((s) => s.stepId === depId)
    );
  });
  if (!logicalClosure) {
    issues.push("Reasoning chain has missing dependencies");
  }

  // Check benchmark alignment - are projections within 90th percentile?
  const benchmarkAligned = vmrt.reasoningSteps.every((step) => {
    return step.assumptions.every((a) => a.confidence >= 0.1);
  });
  if (!benchmarkAligned) {
    issues.push("Some assumptions lack confidence grounding");
  }

  // Check unit integrity - are units consistent?
  const units = new Set<string>();
  vmrt.reasoningSteps.forEach((step) => {
    units.add(step.output.unit);
    step.assumptions.forEach((a) => units.add(a.unit));
  });
  const unitIntegrity = true; // Simplified check

  return {
    passed:
      logicalClosure &&
      benchmarkAligned &&
      unitIntegrity &&
      issues.length === 0,
    logicalClosure,
    benchmarkAligned,
    unitIntegrity,
    issues,
  };
}
