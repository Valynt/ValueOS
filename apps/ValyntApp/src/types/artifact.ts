export type ArtifactType = "document" | "presentation" | "report" | "template";
// "pptx" is excluded — no PPTX rendering pipeline exists. PDF covers the export requirement.
export type ArtifactFormat = "pdf" | "docx" | "html" | "markdown" | "json";
export type AuditEventType = "created" | "updated" | "deleted" | "viewed" | "shared" | "exported";
export type DistributionStatus = "pending" | "sent" | "delivered" | "failed";

export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  format: ArtifactFormat;
  content: string;
  metadata?: Record<string, unknown>;
  version?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  workspace_id?: string;
  tenant_id?: string;
  branding?: BrandingProfile;
  [key: string]: unknown;
}

export interface CreateArtifact {
  name: string;
  type: ArtifactType;
  format?: ArtifactFormat;
  content: string;
  metadata?: Record<string, unknown>;
  branding?: BrandingProfile;
}

export interface UpdateArtifact {
  name?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  branding?: BrandingProfile;
}

export interface ArtifactGenerationRequest {
  templateId?: string;
  type: ArtifactType;
  format: ArtifactFormat;
  data: Record<string, unknown>;
  branding?: BrandingProfile;
  options?: Record<string, unknown>;
}

export interface ArtifactGenerationResult {
  artifact: Artifact;
  success: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface BrandingProfile {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
}

export interface ArtifactTemplate {
  id: string;
  name: string;
  type: ArtifactType;
  branding?: BrandingProfile;
  content: string;
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: number;
  content: string;
  created_at: string;
  created_by?: string;
  changelog?: string;
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  artifactId: string;
  userId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface RetentionPolicy {
  maxVersions?: number;
  maxAgeDays?: number;
  archiveAfterDays?: number;
}

export interface ArtifactStorageMetadata {
  size: number;
  checksum: string;
  storagePath: string;
  contentType: string;
}

export interface DistributionRecord {
  id: string;
  artifactId: string;
  recipient: string;
  status: DistributionStatus;
  sentAt?: string;
  deliveredAt?: string;
  error?: string;
}

export interface ScheduledReport {
  id: string;
  artifactId: string;
  schedule: string;
  recipients: string[];
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}
