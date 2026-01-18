/**
 * Value Drivers API Types
 * 
 * Type definitions for value driver management endpoints.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const DriverType = z.enum([
  'cost_savings',
  'revenue_lift',
  'productivity_gain',
  'risk_mitigation',
]);
export type DriverType = z.infer<typeof DriverType>;

export const DriverStatus = z.enum(['draft', 'published', 'archived']);
export type DriverStatus = z.infer<typeof DriverStatus>;

export const PersonaTag = z.enum([
  'cro',
  'cmo',
  'cfo',
  'cto',
  'vp_sales',
  'se_director',
  'cs_leader',
  'procurement',
]);
export type PersonaTag = z.infer<typeof PersonaTag>;

export const SalesMotionTag = z.enum([
  'new_logo',
  'renewal',
  'expansion',
  'land_expand',
  'competitive_displacement',
]);
export type SalesMotionTag = z.infer<typeof SalesMotionTag>;

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Formula variable schema
 */
export const FormulaVariableSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Must be a valid identifier'),
  name: z.string().min(1).max(50).trim(),
  label: z.string().min(1).max(100).trim(),
  defaultValue: z.number().finite(),
  unit: z.string().max(20).trim(),
  description: z.string().max(200).trim().optional(),
});

export type FormulaVariable = z.infer<typeof FormulaVariableSchema>;

/**
 * Formula schema
 */
export const FormulaSchema = z.object({
  expression: z.string()
    .min(1, 'Expression is required')
    .max(500, 'Expression too long')
    .trim()
    // Basic safety check - no dangerous patterns
    .refine(
      (expr) => !/[;{}]|eval|Function|import|require/.test(expr),
      'Expression contains invalid characters or keywords'
    ),
  variables: z.array(FormulaVariableSchema).min(1).max(20),
  resultUnit: z.enum(['currency', 'percentage', 'hours', 'count']),
});

export type Formula = z.infer<typeof FormulaSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create value driver request
 */
export const CreateValueDriverSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .trim()
    .optional(),
  type: DriverType,
  personaTags: z.array(PersonaTag).min(1).max(8),
  salesMotionTags: z.array(SalesMotionTag).min(1).max(5),
  formula: FormulaSchema,
  narrativePitch: z.string()
    .min(1, 'Narrative pitch is required')
    .max(500, 'Narrative pitch must be 500 characters or less')
    .trim(),
  status: DriverStatus.default('draft'),
}).strict();

export type CreateValueDriverRequest = z.infer<typeof CreateValueDriverSchema>;

/**
 * Update value driver request
 */
export const UpdateValueDriverSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  type: DriverType.optional(),
  personaTags: z.array(PersonaTag).min(1).max(8).optional(),
  salesMotionTags: z.array(SalesMotionTag).min(1).max(5).optional(),
  formula: FormulaSchema.optional(),
  narrativePitch: z.string().min(1).max(500).trim().optional(),
  status: DriverStatus.optional(),
}).strict();

export type UpdateValueDriverRequest = z.infer<typeof UpdateValueDriverSchema>;

/**
 * List value drivers query params
 */
export const ListValueDriversQuerySchema = z.object({
  type: DriverType.optional(),
  status: DriverStatus.optional(),
  persona: PersonaTag.optional(),
  salesMotion: SalesMotionTag.optional(),
  search: z.string().max(100).trim().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'name', 'usage_count']).default('updated_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type ListValueDriversQuery = z.infer<typeof ListValueDriversQuerySchema>;

// ============================================================================
// Response Types
// ============================================================================

/**
 * Value driver entity
 */
export interface ValueDriver {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: DriverType;
  personaTags: PersonaTag[];
  salesMotionTags: SalesMotionTag[];
  formula: Formula;
  narrativePitch: string;
  status: DriverStatus;
  version: number;
  usageCount: number;
  winRateCorrelation?: number;
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
