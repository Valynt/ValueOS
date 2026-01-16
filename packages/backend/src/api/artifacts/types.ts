/**
 * Artifacts API Types
 * 
 * Type definitions for artifact persistence endpoints.
 * Maps between frontend Artifact types and database schema.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ArtifactType = z.enum([
  'value_model',
  'financial_projection',
  'benchmark_comparison',
  'executive_summary',
  'pain_point_analysis',
  'assumption_set',
  'narrative',
  'chart',
  'table',
]);
export type ArtifactType = z.infer<typeof ArtifactType>;

export const ArtifactStatus = z.enum([
  'draft',
  'proposed',
  'approved',
  'rejected',
  'superseded',
]);
export type ArtifactStatus = z.infer<typeof ArtifactStatus>;

export const ContentKind = z.enum(['markdown', 'json', 'table', 'chart']);
export type ContentKind = z.infer<typeof ContentKind>;

// ============================================================================
// Content Schemas
// ============================================================================

const MarkdownContentSchema = z.object({
  kind: z.literal('markdown'),
  markdown: z.string().max(100000),
});

const JsonContentSchema = z.object({
  kind: z.literal('json'),
  data: z.record(z.string(), z.unknown()),
  schema: z.string().max(200).optional(),
});

const TableColumnSchema = z.object({
  key: z.string().max(100),
  label: z.string().max(200),
  type: z.enum(['string', 'number', 'currency', 'percent', 'date']),
  format: z.string().max(50).optional(),
});

const TableContentSchema = z.object({
  kind: z.literal('table'),
  columns: z.array(TableColumnSchema).max(50),
  rows: z.array(z.record(z.string(), z.unknown())).max(1000),
});

const ChartDataPointSchema = z.object({
  label: z.string().max(100),
  value: z.number().finite(),
  category: z.string().max(100).optional(),
});

const ChartContentSchema = z.object({
  kind: z.literal('chart'),
  chartType: z.enum(['bar', 'line', 'pie', 'area']),
  data: z.array(ChartDataPointSchema).max(500),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const ArtifactContentSchema = z.discriminatedUnion('kind', [
  MarkdownContentSchema,
  JsonContentSchema,
  TableContentSchema,
  ChartContentSchema,
]);

export type ArtifactContent = z.infer<typeof ArtifactContentSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create artifact request
 */
export const CreateArtifactSchema = z.object({
  valueCaseId: z.string().uuid().optional(),
  type: ArtifactType,
  title: z.string()
    .min(1, 'Title is required')
    .max(500, 'Title must be 500 characters or less')
    .trim(),
  status: ArtifactStatus.default('proposed'),
  content: ArtifactContentSchema,
  sourceUrl: z.string().url().max(2000).optional(),
  agentRunId: z.string().max(100).optional(),
  checkpointId: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type CreateArtifactRequest = z.infer<typeof CreateArtifactSchema>;

/**
 * Update artifact request
 */
export const UpdateArtifactSchema = z.object({
  title: z.string()
    .min(1)
    .max(500)
    .trim()
    .optional(),
  status: ArtifactStatus.optional(),
  content: ArtifactContentSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type UpdateArtifactRequest = z.infer<typeof UpdateArtifactSchema>;

/**
 * List artifacts query params
 */
export const ListArtifactsQuerySchema = z.object({
  valueCaseId: z.string().uuid().optional(),
  type: ArtifactType.optional(),
  status: ArtifactStatus.optional(),
  search: z.string().max(100).trim().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'title']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type ListArtifactsQuery = z.infer<typeof ListArtifactsQuerySchema>;

/**
 * Batch create artifacts request
 */
export const BatchCreateArtifactsSchema = z.object({
  valueCaseId: z.string().uuid().optional(),
  artifacts: z.array(CreateArtifactSchema.omit({ valueCaseId: true })).min(1).max(20),
}).strict();

export type BatchCreateArtifactsRequest = z.infer<typeof BatchCreateArtifactsSchema>;

// ============================================================================
// Response Types
// ============================================================================

/**
 * Artifact entity (API response)
 */
export interface Artifact {
  id: string;
  tenantId: string;
  valueCaseId?: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  content: ArtifactContent;
  sourceUrl?: string;
  agentRunId?: string;
  checkpointId?: string;
  metadata?: Record<string, unknown>;
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
