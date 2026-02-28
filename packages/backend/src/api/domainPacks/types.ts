/**
 * Domain Packs API Types
 *
 * Zod schemas and TypeScript types for domain pack management.
 * Domain packs provide industry-specific KPI overlays and financial
 * assumptions that seed value cases.
 */

import { z } from 'zod';

import { sanitizeUserInput } from '../../utils/security.js';

// ============================================================================
// Helpers
// ============================================================================

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

export const PackStatus = z.enum(['draft', 'active', 'deprecated']);
export type PackStatus = z.infer<typeof PackStatus>;

export const KpiDirection = z.enum(['increase', 'decrease']);
export type KpiDirection = z.infer<typeof KpiDirection>;

export const AssumptionValueType = z.enum(['number', 'string', 'boolean', 'json']);
export type AssumptionValueType = z.infer<typeof AssumptionValueType>;

// Semver: MAJOR.MINOR.PATCH
export const SemverSchema = z.string().regex(
  /^[0-9]+\.[0-9]+\.[0-9]+$/,
  'Version must be semver (e.g. 1.0.0)'
);

// ============================================================================
// KPI Schema
// ============================================================================

export const DomainPackKpiSchema = z.object({
  kpiKey: sanitizeRequiredText(100),
  defaultName: sanitizeRequiredText(200),
  description: sanitizeText(1000).optional(),
  unit: sanitizeText(20).optional(),
  direction: KpiDirection.optional(),
  baselineHint: sanitizeText(200).optional(),
  targetHint: sanitizeText(200).optional(),
  defaultConfidence: z.number().min(0).max(1).default(0.8),
  sortOrder: z.number().int().nonnegative().default(0),
  tags: z.array(z.string().max(50).trim()).max(20).optional(),
}).strict();

export type DomainPackKpi = z.infer<typeof DomainPackKpiSchema>;

// ============================================================================
// Assumption Schema
// ============================================================================

/**
 * Discriminated by valueType. Exactly one value field must be set.
 * The Zod superRefine enforces the DB-level value_type_enforcement constraint.
 */
export const DomainPackAssumptionSchema = z.object({
  assumptionKey: sanitizeRequiredText(100),
  valueType: AssumptionValueType,
  valueNumber: z.number().finite().optional(),
  valueText: sanitizeText(2000).optional(),
  valueBool: z.boolean().optional(),
  valueJson: z.record(z.string(), z.unknown()).optional(),
  unit: sanitizeText(20).optional(),
  defaultConfidence: z.number().min(0).max(1).default(0.9),
  rationale: sanitizeText(2000).optional(),
  evidenceRefs: z.array(z.record(z.string(), z.unknown())).max(20).default([]),
}).strict().superRefine((data, ctx) => {
  const { valueType, valueNumber, valueText, valueBool, valueJson } = data;

  const typeFieldMap: Record<AssumptionValueType, unknown> = {
    number: valueNumber,
    string: valueText,
    boolean: valueBool,
    json: valueJson,
  };

  // The matching field must be present
  if (typeFieldMap[valueType] === undefined || typeFieldMap[valueType] === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `valueType "${valueType}" requires the corresponding value field to be set`,
    });
  }

  // Other value fields must be absent
  const otherTypes = (Object.keys(typeFieldMap) as AssumptionValueType[])
    .filter((t) => t !== valueType);
  for (const t of otherTypes) {
    if (typeFieldMap[t] !== undefined && typeFieldMap[t] !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `valueType "${valueType}" must not have value field for "${t}"`,
      });
    }
  }
});

export type DomainPackAssumption = z.infer<typeof DomainPackAssumptionSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

export const CreateDomainPackSchema = z.object({
  name: sanitizeRequiredText(200),
  industry: sanitizeRequiredText(100),
  version: SemverSchema.default('1.0.0'),
  parentPackId: z.string().uuid().optional(),
  kpis: z.array(DomainPackKpiSchema).max(100).optional(),
  assumptions: z.array(DomainPackAssumptionSchema).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type CreateDomainPackRequest = z.infer<typeof CreateDomainPackSchema>;

export const UpdateDomainPackSchema = z.object({
  name: sanitizeRequiredText(200).optional(),
  industry: sanitizeRequiredText(100).optional(),
  version: SemverSchema.optional(),
  status: PackStatus.optional(),
  kpis: z.array(DomainPackKpiSchema).max(100).optional(),
  assumptions: z.array(DomainPackAssumptionSchema).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type UpdateDomainPackRequest = z.infer<typeof UpdateDomainPackSchema>;

export const ListDomainPacksQuerySchema = z.object({
  status: PackStatus.optional(),
  industry: z.string().max(100).trim().optional(),
  search: z.string().max(100).trim().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'name', 'industry']).default('updated_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type ListDomainPacksQuery = z.infer<typeof ListDomainPacksQuerySchema>;

// ============================================================================
// Response / Entity Types
// ============================================================================

export interface DomainPack {
  id: string;
  tenantId: string | null;
  name: string;
  industry: string;
  version: string;
  status: PackStatus;
  parentPackId: string | null;
  kpis: DomainPackKpi[];
  assumptions: DomainPackAssumption[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Effective pack after parent+child merge.
 * Used by agents to get the resolved set of KPIs and assumptions.
 */
export interface EffectiveDomainPack {
  packId: string;
  parentPackId: string | null;
  name: string;
  industry: string;
  version: string;
  kpis: DomainPackKpi[];
  assumptions: DomainPackAssumption[];
}

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

export interface ApiErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}
