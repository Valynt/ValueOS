/**
 * Value Cases API Types
 *
 * Type definitions for value case management endpoints.
 */

import { z } from 'zod';

import { sanitizeUserInput } from '../../utils/security.js';

const sanitizeText = (maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeUserInput(value, maxLength) : value),
    z.string().max(maxLength).trim()
  );

const sanitizeRequiredText = (maxLength: number, minLength = 1) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeUserInput(value, maxLength) : value),
    z.string().min(minLength).max(maxLength).trim()
  );

// ============================================================================
// Enums
// ============================================================================

/**
 * CaseStatus — aligned with database constraint
 *
 * Migration: 20260323000002_value_cases_consistency_alignment.sql updated
 * the DB check constraint to match these values:
 *   ['draft', 'in_progress', 'committed', 'closed']
 *
 * Mapping from old DB values:
 *   'review' -> 'in_progress'
 *   'published' -> 'committed'
 *   'archived' is deprecated (use 'closed' for completed cases)
 *
 * Domain OpportunityStatus (Opportunity.ts) uses a different vocabulary:
 *   ['active', 'on_hold', 'closed_won', 'closed_lost']
 * This is intentional — CaseStatus tracks workflow state, OpportunityStatus
 * tracks sales outcome. Bridge mapping belongs in service layer.
 */
export const CaseStatus = z.enum(['draft', 'in_progress', 'committed', 'closed']);
export type CaseStatus = z.infer<typeof CaseStatus>;

export const CasePhase = z.enum(['discovery', 'analysis', 'modeling', 'review', 'finalize']);
export type CasePhase = z.infer<typeof CasePhase>;

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Stakeholder schema
 */
export const StakeholderSchema = z.object({
  id: z.string().uuid(),
  name: sanitizeRequiredText(100),
  title: sanitizeText(100).optional(),
  email: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeUserInput(value, 255) : value),
    z.string().email().max(255).toLowerCase()
  ).optional(),
  role: z.enum(['champion', 'decision_maker', 'influencer', 'end_user']).optional(),
});

export type Stakeholder = z.infer<typeof StakeholderSchema>;

/**
 * Value metric schema
 */
export const ValueMetricSchema = z.object({
  id: z.string().uuid(),
  name: sanitizeRequiredText(100),
  category: sanitizeRequiredText(50),
  currentValue: z.number().finite(),
  projectedValue: z.number().finite(),
  unit: sanitizeRequiredText(20),
  confidence: z.number().min(0).max(100).optional(),
  assumptions: z
    .array(
      z.preprocess(
        (value) => (typeof value === 'string' ? sanitizeUserInput(value, 500) : value),
        z.string().max(500).trim()
      )
    )
    .max(10)
    .optional(),
});

export type ValueMetric = z.infer<typeof ValueMetricSchema>;

/**
 * Value driver reference schema
 */
export const ValueDriverRefSchema = z.object({
  driverId: z.string().uuid(),
  customValues: z.record(z.string(), z.number().finite()).optional(),
  calculatedValue: z.number().finite().optional(),
});

export type ValueDriverRef = z.infer<typeof ValueDriverRefSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create value case request
 */
export const CreateValueCaseSchema = z.object({
  name: sanitizeRequiredText(200),
  companyName: sanitizeRequiredText(200),
  companyId: z.string().uuid().optional(),
  description: sanitizeText(2000).optional(),
  templateId: z.string().uuid().optional(),
  domainPackId: z.string().uuid().optional(),
  domainPackVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/, 'Must be semver').optional(),
  stakeholders: z.array(StakeholderSchema).max(20).optional(),
  valueDrivers: z.array(ValueDriverRefSchema).max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict().refine(
  (data) => !data.domainPackId || data.domainPackVersion,
  { message: 'domainPackVersion is required when domainPackId is set', path: ['domainPackVersion'] },
);

export type CreateValueCaseRequest = z.infer<typeof CreateValueCaseSchema>;

/**
 * Update value case request
 */
export const UpdateValueCaseSchema = z.object({
  name: sanitizeRequiredText(200).optional(),
  description: sanitizeText(2000).optional(),
  status: CaseStatus.optional(),
  phase: CasePhase.optional(),
  domainPackId: z.string().uuid().nullable().optional(),
  domainPackVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/, 'Must be semver').nullable().optional(),
  stakeholders: z.array(StakeholderSchema).max(20).optional(),
  metrics: z.array(ValueMetricSchema).max(100).optional(),
  valueDrivers: z.array(ValueDriverRefSchema).max(50).optional(),
  totalValue: z.number().finite().nonnegative().optional(),
  npv: z.number().finite().optional(),
  paybackMonths: z.number().int().nonnegative().max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type UpdateValueCaseRequest = z.infer<typeof UpdateValueCaseSchema>;

/**
 * List value cases query params
 */
export const ListValueCasesQuerySchema = z.object({
  status: CaseStatus.optional(),
  search: z.string().max(100).trim().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'name', 'total_value']).default('updated_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type ListValueCasesQuery = z.infer<typeof ListValueCasesQuerySchema>;

// ============================================================================
// Response Types
// ============================================================================

/**
 * Value case entity
 *
 * Note: integrity_score is materialized on both value_cases and business_cases
 * for consistent querying. Updated by ValueIntegrityService after each agent run.
 */
export interface ValueCase {
  id: string;
  tenantId: string;
  name: string;
  companyName: string;
  companyId?: string;
  description?: string;
  status: CaseStatus;
  phase: CasePhase;
  domainPackId: string | null;
  domainPackVersion: string | null;
  domainPackSnapshot: Record<string, unknown> | null;
  stakeholders: Stakeholder[];
  metrics: ValueMetric[];
  valueDrivers: ValueDriverRef[];
  totalValue?: number;
  npv?: number;
  paybackMonths?: number;
  templateId?: string;
  metadata?: Record<string, unknown>;
  /** Materialized integrity score (0-1). NULL until first computation. */
  integrityScore?: number | null;
  /** When integrity was last evaluated. */
  integrityEvaluatedAt?: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

// ============================================================================
// ModelStage API Schemas (Economic Kernel Integration)
// ============================================================================

/**
 * Cash flow input for Economic Kernel calculation
 */
export const CashFlowInputSchema = z.object({
  period: z.number().int().nonnegative(), // 0 = initial investment
  amount: z.string(), // Decimal as string (negative for outflows, positive for inflows)
  description: sanitizeText(200).optional(),
});

export type CashFlowInput = z.infer<typeof CashFlowInputSchema>;

/**
 * Assumption input for sensitivity analysis
 */
export const AssumptionInputSchema = z.object({
  id: z.string().uuid(),
  name: sanitizeRequiredText(100),
  value: z.string(), // Decimal as string
  unit: sanitizeRequiredText(20),
  sensitivity_low: z.string().optional(), // Decimal multiplier (e.g., "0.8" for -20%)
  sensitivity_high: z.string().optional(), // Decimal multiplier (e.g., "1.2" for +20%)
});

export type AssumptionInput = z.infer<typeof AssumptionInputSchema>;

/**
 * Request to calculate financial metrics using Economic Kernel
 */
export const CalculateRequestSchema = z.object({
  cashFlows: z.array(CashFlowInputSchema).min(2), // At least initial + one future flow
  discountRate: z.string().regex(/^0\.\d+$/), // Decimal as string (e.g., "0.10" for 10%)
  assumptions: z.array(AssumptionInputSchema).optional(),
}).strict();

export type CalculateRequest = z.infer<typeof CalculateRequestSchema>;

/**
 * Scenario definition for what-if analysis
 */
export const ScenarioTypeSchema = z.enum(['conservative', 'base', 'upside']);
export type ScenarioType = z.infer<typeof ScenarioTypeSchema>;

/**
 * Request to generate scenarios
 */
export const ScenarioRequestSchema = z.object({
  baseAssumptions: z.array(AssumptionInputSchema),
  scenarioMultipliers: z.object({
    conservative: z.record(z.string(), z.string()), // assumption_id -> multiplier
    upside: z.record(z.string(), z.string()),
  }).optional(),
  discountRate: z.string().regex(/^0\.\d+$/),
}).strict();

export type ScenarioRequest = z.infer<typeof ScenarioRequestSchema>;

/**
 * Response from Economic Kernel calculation
 */
export interface CalculationResult {
  npv: string; // Decimal as string
  irr: string; // Decimal as string (e.g., "0.2345" for 23.45%)
  roi: string; // Decimal as string (multiplier, e.g., "2.5" for 250%)
  paybackMonths: number;
  paybackFractional: string; // Decimal as string
  presentValues: string[]; // Per-period PVs as strings
  irrConverged: boolean;
  irrIterations: number;
}

/**
 * Scenario result with full calculation
 */
export interface ScenarioResult extends CalculationResult {
  scenario: ScenarioType;
  assumptions: Array<{
    id: string;
    name: string;
    baseValue: string;
    adjustedValue: string;
    multiplier: string;
  }>;
}

/**
 * Full ModelStage calculation response
 */
export interface ModelStageCalculationResponse {
  base: CalculationResult;
  scenarios: ScenarioResult[];
  sensitivity?: Array<{
    assumptionId: string;
    assumptionName: string;
    baseValue: string;
    npvAtLow: string;
    npvAtHigh: string;
    npvDelta: string;
  }>;
  calculatedAt: string;
}
