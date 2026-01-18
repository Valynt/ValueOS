/**
 * Value Cases API Types
 * 
 * Type definitions for value case management endpoints.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

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
  name: z.string().min(1).max(100).trim(),
  title: z.string().max(100).trim().optional(),
  email: z.string().email().max(255).toLowerCase().optional(),
  role: z.enum(['champion', 'decision_maker', 'influencer', 'end_user']).optional(),
});

export type Stakeholder = z.infer<typeof StakeholderSchema>;

/**
 * Value metric schema
 */
export const ValueMetricSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  category: z.string().max(50).trim(),
  currentValue: z.number().finite(),
  projectedValue: z.number().finite(),
  unit: z.string().max(20).trim(),
  confidence: z.number().min(0).max(100).optional(),
  assumptions: z.array(z.string().max(500)).max(10).optional(),
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
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less')
    .trim(),
  companyName: z.string()
    .min(1, 'Company name is required')
    .max(200, 'Company name must be 200 characters or less')
    .trim(),
  companyId: z.string().uuid().optional(),
  description: z.string()
    .max(2000, 'Description must be 2000 characters or less')
    .trim()
    .optional(),
  templateId: z.string().uuid().optional(),
  stakeholders: z.array(StakeholderSchema).max(20).optional(),
  valueDrivers: z.array(ValueDriverRefSchema).max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict(); // Reject unknown fields

export type CreateValueCaseRequest = z.infer<typeof CreateValueCaseSchema>;

/**
 * Update value case request
 */
export const UpdateValueCaseSchema = z.object({
  name: z.string()
    .min(1)
    .max(200)
    .trim()
    .optional(),
  description: z.string()
    .max(2000)
    .trim()
    .optional(),
  status: CaseStatus.optional(),
  phase: CasePhase.optional(),
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
  stakeholders: Stakeholder[];
  metrics: ValueMetric[];
  valueDrivers: ValueDriverRef[];
  totalValue?: number;
  npv?: number;
  paybackMonths?: number;
  templateId?: string;
  metadata?: Record<string, unknown>;
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
