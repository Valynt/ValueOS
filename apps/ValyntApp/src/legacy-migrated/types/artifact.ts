/**
 * Artifact Types and Schemas
 * Defines the structure for ValueOS artifacts (PDFs, PowerPoint decks, reports)
 *
 * An Artifact is a stateful, regenerable, authoritative representation of economic truth
 * that binds narrative, data, assumptions, versioning, branding, and distribution.
 */

import { z } from "zod";

// ============================================================================
// Artifact Types
// ============================================================================

export const ArtifactTypeSchema = z.enum([
  "executive_summary",
  "cfo_brief",
  "board_deck",
  "renewal_justification",
  "quarterly_value_report",
  "sales_proposal",
  "expansion_opportunity",
]);

export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

// ============================================================================
// Artifact Formats
// ============================================================================

export const ArtifactFormatSchema = z.enum([
  "pdf",
  "pptx",
  "html",
  "csv",
  "json",
]);

export type ArtifactFormat = z.infer<typeof ArtifactFormatSchema>;

// ============================================================================
// Branding Profile
// ============================================================================

export const BrandingProfileSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  logoUrl: z.string().url(),
  fontFamily: z.string(),
  companyName: z.string(),
  tagline: z.string().optional(),
  terminology: z.object({
    roi: z.string(),
    valueCase: z.string(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BrandingProfile = z.infer<typeof BrandingProfileSchema>;

// ============================================================================
// Artifact Template
// ============================================================================

export const ArtifactTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: ArtifactTypeSchema,
  format: ArtifactFormatSchema,
  version: z.string(),
  structure: z.record(z.any()),
  metadata: z.object({
    description: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isDefault: z.boolean().optional(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ArtifactTemplate = z.infer<typeof ArtifactTemplateSchema>;

// ============================================================================
// Artifact Version
// ============================================================================

export const ArtifactVersionSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  version: z.string(),
  format: ArtifactFormatSchema,
  data: z.record(z.any()),
  metadata: z.object({
    generatedAt: z.string().datetime(),
    generatedBy: z.string(),
    dataHash: z.string(),
    sourceDataVersion: z.string().optional(),
    assumptions: z.array(z.object({
      key: z.string(),
      value: z.any(),
      description: z.string().optional(),
    })).optional(),
  }),
  createdAt: z.string().datetime(),
});

export type ArtifactVersion = z.infer<typeof ArtifactVersionSchema>;

// ============================================================================
// Artifact Schema
// ============================================================================

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: ArtifactTypeSchema,
  format: ArtifactFormatSchema,
  name: z.string(),
  description: z.string().optional(),

  // Data binding
  valueCaseId: z.string().uuid().optional(),
  workflowExecutionId: z.string().uuid().optional(),
  sourceData: z.record(z.any()).optional(),

  // Branding
  brandingProfileId: z.string().uuid().optional(),

  // Versioning
  currentVersion: z.string(),
  versionHistory: z.array(z.string()),

  // Distribution
  distributionOptions: z.object({
    email: z.array(z.string()).optional(),
    webhooks: z.array(z.string()).optional(),
    retentionDays: z.number().int().positive().optional(),
  }).optional(),

  // Status
  status: z.enum(["draft", "generating", "ready", "failed", "archived"]),

  // Metadata
  metadata: z.object({
    templateId: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
  }).optional(),

  // Audit
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().optional(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

// ============================================================================
// Create/Update Input Types
// ============================================================================

export const CreateArtifactSchema = ArtifactSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  currentVersion: true,
  versionHistory: true,
  status: true,
}).extend({
  status: z.enum(["draft", "generating"]).optional(),
});

export type CreateArtifact = z.infer<typeof CreateArtifactSchema>;

export const UpdateArtifactSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  brandingProfileId: z.string().uuid().optional(),
  distributionOptions: z.object({
    email: z.array(z.string()).optional(),
    webhooks: z.array(z.string()).optional(),
    retentionDays: z.number().int().positive().optional(),
  }).optional(),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
  }).optional(),
});

export type UpdateArtifact = z.infer<typeof UpdateArtifactSchema>;

// ============================================================================
// Artifact Generation Request
// ============================================================================

export const ArtifactGenerationRequestSchema = z.object({
  artifactType: ArtifactTypeSchema,
  valueCaseId: z.string().uuid(),
  brandingProfileId: z.string().uuid().optional(),
  format: ArtifactFormatSchema,
  includeVersionHistory: z.boolean().optional(),
  distributionOptions: z.object({
    email: z.array(z.string()).optional(),
    webhooks: z.array(z.string()).optional(),
    retentionDays: z.number().int().positive().optional(),
  }).optional(),
});

export type ArtifactGenerationRequest = z.infer<typeof ArtifactGenerationRequestSchema>;

// ============================================================================
// Artifact Generation Result
// ============================================================================

export const ArtifactGenerationResultSchema = z.object({
  success: z.boolean(),
  artifactId: z.string().uuid().optional(),
  versionId: z.string().uuid().optional(),
  format: ArtifactFormatSchema.optional(),
  data: z.any().optional(),
  metadata: z.object({
    generatedAt: z.string().datetime(),
    generationTimeMs: z.number(),
    dataHash: z.string(),
  }).optional(),
  errors: z.array(z.string()).optional(),
});

export type ArtifactGenerationResult = z.infer<typeof ArtifactGenerationResultSchema>;

// ============================================================================
// Scheduled Report
// ============================================================================

export const ScheduledReportSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  artifactType: ArtifactTypeSchema,
  format: ArtifactFormatSchema,

  schedule: z.object({
    frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    timezone: z.string(),
  }),

  recipients: z.array(z.string().email()),
  filters: z.record(z.any()).optional(),
  brandingProfileId: z.string().uuid().optional(),

  retentionPolicy: z.object({
    keepVersions: z.number().int().positive(),
    archiveAfter: z.number().int().positive(),
  }),

  lastRunAt: z.string().datetime().optional(),
  nextRunAt: z.string().datetime(),

  isActive: z.boolean(),

  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ScheduledReport = z.infer<typeof ScheduledReportSchema>;

// ============================================================================
// Audit Event Types
// ============================================================================

export const AuditEventTypeSchema = z.enum([
  "artifact_created",
  "artifact_updated",
  "artifact_generated",
  "artifact_versioned",
  "artifact_archived",
  "artifact_shared",
  "artifact_downloaded",
  "artifact_deleted",
]);

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

// ============================================================================
// Audit Event
// ============================================================================

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  eventType: AuditEventTypeSchema,
  userId: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================================================
// Retention Policy
// ============================================================================

export const RetentionPolicySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  artifactType: ArtifactTypeSchema.optional(),
  format: ArtifactFormatSchema.optional(),

  rules: z.object({
    keepVersions: z.number().int().positive(),
    archiveAfterDays: z.number().int().positive(),
    deleteAfterDays: z.number().int().positive().optional(),
    maxStorageSizeMB: z.number().int().positive().optional(),
  }),

  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

// ============================================================================
// Artifact Storage Metadata
// ============================================================================

export const ArtifactStorageMetadataSchema = z.object({
  artifactId: z.string().uuid(),
  versionId: z.string().uuid(),
  storagePath: z.string(),
  format: ArtifactFormatSchema,
  sizeBytes: z.number().int().positive(),
  mimeType: z.string(),
  checksum: z.string(),
  uploadedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type ArtifactStorageMetadata = z.infer<typeof ArtifactStorageMetadataSchema>;

// ============================================================================
// Distribution Status
// ============================================================================

export const DistributionStatusSchema = z.enum([
  "pending",
  "sending",
  "delivered",
  "failed",
  "retrying",
]);

export type DistributionStatus = z.infer<typeof DistributionStatusSchema>;

// ============================================================================
// Distribution Record
// ============================================================================

export const DistributionRecordSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  versionId: z.string().uuid(),
  channel: z.enum(["email", "webhook", "api"]),
  recipient: z.string(),
  status: DistributionStatusSchema,
  attempts: z.number().int().positive(),
  lastAttemptAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DistributionRecord = z.infer<typeof DistributionRecordSchema>;

