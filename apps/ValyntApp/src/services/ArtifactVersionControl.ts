/**
 * Artifact Version Control Service
 * Handles versioning, audit logging, and compliance for artifacts
 *
 * This service provides immutable versioning, comprehensive audit trails,
 * and compliance-ready logging for all artifact operations
 */

import { createClient } from "@supabase/supabase-js";
import { EventEmitter } from "events";

import {
  Artifact,
  ArtifactStorageMetadata,
  ArtifactVersion,
  AuditEvent,
  AuditEventType,
  DistributionRecord,
  RetentionPolicy,
} from "../types/artifact";

import { Database } from "../types/database";

// ============================================================================
// Configuration
// ============================================================================

export interface VersionControlConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  maxVersionsPerArtifact: number;
  retentionDays: number;
  auditLogRetentionDays: number;
  enableImmutableVersioning: boolean;
  enableAuditCompression: boolean;
}

// ============================================================================
// Version Control Service
// ============================================================================

export class ArtifactVersionControl extends EventEmitter {
  private supabase: ReturnType<typeof createClient<Database>>;
  private config: VersionControlConfig;

  constructor(config: VersionControlConfig) {
    super();
    this.config = config;
    this.supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey);
  }

  // ============================================================================
  // Version Management
  // ============================================================================

  /**
   * Create immutable version of artifact
   */
  async createVersion(
    artifactId: string,
    data: unknown,
    metadata: {
      generatedBy: string;
      dataHash: string;
      sourceDataVersion?: string;
      assumptions?: unknown[];
      tags?: string[];
    }
  ): Promise<ArtifactVersion> {
    const artifact = await this.getArtifact(artifactId);
    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    // Check version limit
    if (this.config.maxVersionsPerArtifact > 0) {
      const versions = await this.getVersionHistory(artifactId);
      if (versions.length >= this.config.maxVersionsPerArtifact) {
        // Archive oldest version
        await this.archiveOldestVersion(artifactId);
      }
    }

    // Generate version number (semantic versioning)
    const newVersion = this.generateVersionNumber(artifact.currentVersion);

    const version: ArtifactVersion = {
      id: crypto.randomUUID(),
      artifactId,
      version: newVersion,
      format: artifact.format,
      data,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: metadata.generatedBy,
        dataHash: metadata.dataHash,
        sourceDataVersion: metadata.sourceDataVersion,
        assumptions: metadata.assumptions,
        tags: metadata.tags,
      },
      createdAt: new Date().toISOString(),
    };

    const { data: inserted, error } = await this.supabase
      .from("artifact_versions")
      .insert(version)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create version: ${error.message}`);
    }

    // Update artifact with new version
    await this.updateArtifactVersion(artifactId, newVersion);

    // Log audit event
    await this.logAuditEvent(artifactId, "artifact_versioned", metadata.generatedBy, {
      version: newVersion,
      dataHash: metadata.dataHash,
    });

    // Emit event
    this.emit("version_created", {
      artifactId,
      versionId: version.id,
      version: newVersion,
    });

    return inserted;
  }

  /**
   * Get version history
   */
  async getVersionHistory(artifactId: string): Promise<ArtifactVersion[]> {
    const { data, error } = await this.supabase
      .from("artifact_versions")
      .select()
      .eq("artifactId", artifactId)
      .order("createdAt", { ascending: false });

    if (error) {
      throw new Error(`Failed to get version history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get specific version
   */
  async getVersion(artifactId: string, version: string): Promise<ArtifactVersion | null> {
    const { data, error } = await this.supabase
      .from("artifact_versions")
      .select()
      .eq("artifactId", artifactId)
      .eq("version", version)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to get version: ${error.message}`);
    }

    return data;
  }

  /**
   * Compare versions
   */
  async compareVersions(
    artifactId: string,
    versionA: string,
    versionB: string
  ): Promise<{
    versionA: ArtifactVersion | null;
    versionB: ArtifactVersion | null;
    differences: unknown[];
  }> {
    const [vA, vB] = await Promise.all([
      this.getVersion(artifactId, versionA),
      this.getVersion(artifactId, versionB),
    ]);

    if (!vA || !vB) {
      throw new Error("One or both versions not found");
    }

    const differences = this.findDifferences(vA.data, vB.data);

    return {
      versionA: vA,
      versionB: vB,
      differences,
    };
  }

  /**
   * Rollback to previous version
   */
  async rollbackVersion(
    artifactId: string,
    targetVersion: string,
    userId: string
  ): Promise<ArtifactVersion> {
    const version = await this.getVersion(artifactId, targetVersion);
    if (!version) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    // Create new version with rollback data
    const rollbackVersion = await this.createVersion(artifactId, version.data, {
      generatedBy: userId,
      dataHash: version.metadata.dataHash,
      sourceDataVersion: targetVersion,
      tags: ["rollback"],
    });

    // Log audit event
    await this.logAuditEvent(artifactId, "artifact_versioned", userId, {
      rollbackTo: targetVersion,
      newVersion: rollbackVersion.version,
    });

    return rollbackVersion;
  }

  // ============================================================================
  // Audit Logging
  // ============================================================================

  /**
   * Log audit event
   */
  async logAuditEvent(
    artifactId: string,
    eventType: AuditEventType,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    const artifact = await this.getArtifact(artifactId);
    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    const event: AuditEvent = {
      id: crypto.randomUUID(),
      artifactId,
      organizationId: artifact.organizationId,
      tenantId: artifact.tenantId,
      eventType,
      userId,
      metadata,
      createdAt: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from("artifact_audit_events")
      .insert(event)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to log audit event: ${error.message}`);
    }

    // Emit event
    this.emit("audit_logged", {
      artifactId,
      eventType,
      userId,
    });

    return data;
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(artifactId: string): Promise<AuditEvent[]> {
    const { data, error } = await this.supabase
      .from("artifact_audit_events")
      .select()
      .eq("artifactId", artifactId)
      .order("createdAt", { ascending: true });

    if (error) {
      throw new Error(`Failed to get audit trail: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get audit trail with filters
   */
  async getAuditTrailWithFilters(filters: {
    artifactId?: string;
    organizationId?: string;
    tenantId?: string;
    eventType?: AuditEventType;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    let query = this.supabase.from("artifact_audit_events").select();

    if (filters.artifactId) {
      query = query.eq("artifactId", filters.artifactId);
    }
    if (filters.organizationId) {
      query = query.eq("organizationId", filters.organizationId);
    }
    if (filters.tenantId) {
      query = query.eq("tenantId", filters.tenantId);
    }
    if (filters.eventType) {
      query = query.eq("eventType", filters.eventType);
    }
    if (filters.userId) {
      query = query.eq("userId", filters.userId);
    }
    if (filters.startDate) {
      query = query.gte("createdAt", filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte("createdAt", filters.endDate);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query.order("createdAt", { ascending: false });

    if (error) {
      throw new Error(`Failed to get audit trail: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Export audit trail
   */
  async exportAuditTrail(
    artifactId: string,
    format: "json" | "csv" = "json"
  ): Promise<string> {
    const auditTrail = await this.getAuditTrail(artifactId);

    if (format === "csv") {
      const headers = ["id", "artifactId", "eventType", "userId", "metadata", "createdAt"];
      const rows = auditTrail.map(event => [
        event.id,
        event.artifactId,
        event.eventType,
        event.userId,
        JSON.stringify(event.metadata || {}),
        event.createdAt,
      ]);

      const csv = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
      return csv;
    }

    return JSON.stringify(auditTrail, null, 2);
  }

  // ============================================================================
  // Compliance & Integrity
  // ============================================================================

  /**
   * Verify artifact integrity
   */
  async verifyIntegrity(artifactId: string): Promise<{
    valid: boolean;
    issues: string[];
    checksum: string;
  }> {
    const artifact = await this.getArtifact(artifactId);
    if (!artifact) {
      return {
        valid: false,
        issues: ["Artifact not found"],
        checksum: "",
      };
    }

    const issues: string[] = [];

    // Check if artifact has versions
    const versions = await this.getVersionHistory(artifactId);
    if (versions.length === 0) {
      issues.push("No versions found");
    }

    // Verify current version exists
    const currentVersion = await this.getVersion(artifactId, artifact.currentVersion);
    if (!currentVersion) {
      issues.push(`Current version ${artifact.currentVersion} not found`);
    }

    // Verify audit trail exists
    const auditTrail = await this.getAuditTrail(artifactId);
    if (auditTrail.length === 0) {
      issues.push("No audit trail found");
    }

    // Verify storage metadata
    const storageMetadata = await this.getStorageMetadata(artifactId);
    if (storageMetadata.length === 0) {
      issues.push("No storage metadata found");
    }

    return {
      valid: issues.length === 0,
      issues,
      checksum: currentVersion?.metadata.dataHash || "",
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(artifactId: string): Promise<{
    artifactId: string;
    integrity: {
      valid: boolean;
      issues: string[];
    };
    versioning: {
      totalVersions: number;
      currentVersion: string;
      versionHistory: string[];
    };
    audit: {
      totalEvents: number;
      eventTypes: Record<AuditEventType, number>;
      lastEvent: AuditEvent | null;
    };
    storage: {
      totalSize: number;
      files: number;
      retentionStatus: string;
    };
    generatedAt: string;
  }> {
    const [artifact, versions, auditTrail, storageMetadata] = await Promise.all([
      this.getArtifact(artifactId),
      this.getVersionHistory(artifactId),
      this.getAuditTrail(artifactId),
      this.getStorageMetadata(artifactId),
    ]);

    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    // Count event types
    const eventTypes = auditTrail.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<AuditEventType, number>);

    // Calculate total size
    const totalSize = storageMetadata.reduce((sum, meta) => sum + meta.sizeBytes, 0);

    // Check retention status
    const retentionStatus = this.checkRetentionStatus(artifact, versions);

    return {
      artifactId,
      integrity: await this.verifyIntegrity(artifactId),
      versioning: {
        totalVersions: versions.length,
        currentVersion: artifact.currentVersion,
        versionHistory: versions.map(v => v.version),
      },
      audit: {
        totalEvents: auditTrail.length,
        eventTypes,
        lastEvent: auditTrail.length > 0 ? auditTrail[auditTrail.length - 1] : null,
      },
      storage: {
        totalSize,
        files: storageMetadata.length,
        retentionStatus,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Retention Management
  // ============================================================================

  /**
   * Apply retention policy
   */
  async applyRetentionPolicy(policy: RetentionPolicy): Promise<{
    archived: number;
    deleted: number;
    errors: string[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.rules.archiveAfterDays);

    const result = {
      archived: 0,
      deleted: 0,
      errors: [] as string[],
    };

    // Get artifacts to process
    const { data: artifacts, error } = await this.supabase
      .from("workflow_artifacts")
      .select()
      .eq("organizationId", policy.organizationId)
      .eq("status", "ready")
      .lt("createdAt", cutoffDate.toISOString());

    if (error) {
      result.errors.push(`Failed to get artifacts: ${error.message}`);
      return result;
    }

    // Process each artifact
    for (const artifact of artifacts || []) {
      try {
        // Archive artifact
        await this.updateArtifactStatus(artifact.id, "archived");
        result.archived++;

        // Clean up old versions
        if (policy.rules.keepVersions > 0) {
          const deletedCount = await this.cleanupOldVersions(artifact.id, policy.rules.keepVersions);
          result.deleted += deletedCount;
        }

        // Log audit event
        await this.logAuditEvent(artifact.id, "artifact_archived", "system", {
          policyId: policy.id,
          reason: "retention_policy",
        });
      } catch (error) {
        result.errors.push(`Failed to process artifact ${artifact.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return result;
  }

  /**
   * Cleanup old versions
   */
  async cleanupOldVersions(artifactId: string, keepVersions: number): Promise<number> {
    const versions = await this.getVersionHistory(artifactId);

    if (versions.length <= keepVersions) {
      return 0;
    }

    const versionsToDelete = versions.slice(keepVersions);
    let deletedCount = 0;

    for (const version of versionsToDelete) {
      try {
        // Delete from storage
        const filePath = `artifacts/${artifactId}/${version.id}.${version.format}`;
        await this.supabase.storage
          .from("artifacts")
          .remove([filePath]);

        // Delete version record
        await this.supabase
          .from("artifact_versions")
          .delete()
          .eq("id", version.id);

        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete version ${version.id}:`, error);
      }
    }

    return deletedCount;
  }

  // ============================================================================
  // Storage Management
  // ============================================================================

  /**
   * Get storage metadata
   */
  async getStorageMetadata(artifactId: string): Promise<ArtifactStorageMetadata[]> {
    const { data, error } = await this.supabase
      .from("artifact_storage_metadata")
      .select()
      .eq("artifactId", artifactId);

    if (error) {
      throw new Error(`Failed to get storage metadata: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Verify storage integrity
   */
  async verifyStorageIntegrity(artifactId: string): Promise<{
    valid: boolean;
    issues: string[];
    totalSize: number;
  }> {
    const storageMetadata = await this.getStorageMetadata(artifactId);
    const issues: string[] = [];

    if (storageMetadata.length === 0) {
      issues.push("No storage metadata found");
    }

    // Verify each file exists
    for (const meta of storageMetadata) {
      try {
        const { error } = await this.supabase.storage
          .from("artifacts")
          .list(meta.storagePath);

        if (error) {
          issues.push(`File not found: ${meta.storagePath}`);
        }
      } catch (error) {
        issues.push(`Failed to verify file ${meta.storagePath}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    const totalSize = storageMetadata.reduce((sum, meta) => sum + meta.sizeBytes, 0);

    return {
      valid: issues.length === 0,
      issues,
      totalSize,
    };
  }

  // ============================================================================
  // Distribution Tracking
  // ============================================================================

  /**
   * Track distribution
   */
  async trackDistribution(
    artifactId: string,
    versionId: string,
    channel: "email" | "webhook" | "api",
    recipient: string
  ): Promise<DistributionRecord> {
    const record: DistributionRecord = {
      id: crypto.randomUUID(),
      artifactId,
      versionId,
      channel,
      recipient,
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from("artifact_distributions")
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to track distribution: ${error.message}`);
    }

    return data;
  }

  /**
   * Update distribution status
   */
  async updateDistributionStatus(
    recordId: string,
    status: DistributionRecord["status"],
    error?: string
  ): Promise<DistributionRecord> {
    const { data, error: updateError } = await this.supabase
      .from("artifact_distributions")
      .update({
        status,
        error,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", recordId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update distribution status: ${updateError.message}`);
    }

    return data;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async getArtifact(artifactId: string): Promise<Artifact | null> {
    const { data, error } = await this.supabase
      .from("workflow_artifacts")
      .select()
      .eq("id", artifactId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to get artifact: ${error.message}`);
    }

    return data;
  }

  private async updateArtifactVersion(artifactId: string, newVersion: string): Promise<void> {
    const { error } = await this.supabase
      .from("workflow_artifacts")
      .update({
        currentVersion: newVersion,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", artifactId);

    if (error) {
      throw new Error(`Failed to update artifact version: ${error.message}`);
    }
  }

  private async updateArtifactStatus(artifactId: string, status: Artifact["status"]): Promise<void> {
    const { error } = await this.supabase
      .from("workflow_artifacts")
      .update({
        status,
        updatedAt: new Date().toISOString(),
        archivedAt: status === "archived" ? new Date().toISOString() : undefined,
      })
      .eq("id", artifactId);

    if (error) {
      throw new Error(`Failed to update artifact status: ${error.message}`);
    }
  }

  private async archiveOldestVersion(artifactId: string): Promise<void> {
    const versions = await this.getVersionHistory(artifactId);
    if (versions.length === 0) return;

    const oldestVersion = versions[versions.length - 1];

    // Delete from storage
    const filePath = `artifacts/${artifactId}/${oldestVersion.id}.${oldestVersion.format}`;
    await this.supabase.storage
      .from("artifacts")
      .remove([filePath]);

    // Delete version record
    await this.supabase
      .from("artifact_versions")
      .delete()
      .eq("id", oldestVersion.id);
  }

  private generateVersionNumber(currentVersion: string): string {
    const [major, minor, patch] = currentVersion.split(".").map(Number);

    // Simple semantic versioning: increment patch for minor changes
    // In a real implementation, this would be more sophisticated
    return `${major}.${minor}.${patch + 1}`;
  }

  private findDifferences(dataA: unknown, dataB: unknown): unknown[] {
    const differences: unknown[] = [];

    const compare = (a: unknown, b: unknown, path: string = "") => {
      if (a === b) return;

      if (typeof a !== typeof b) {
        differences.push({
          path,
          type: "type_mismatch",
          oldValue: a,
          newValue: b,
        });
        return;
      }

      if (typeof a === "object" && a !== null && b !== null) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        const allKeys = new Set([...keysA, ...keysB]);

        for (const key of allKeys) {
          const newPath = path ? `${path}.${key}` : key;
          if (key in a && key in b) {
            compare(a[key], b[key], newPath);
          } else if (key in a) {
            differences.push({
              path: newPath,
              type: "removed",
              oldValue: a[key],
            });
          } else {
            differences.push({
              path: newPath,
              type: "added",
              newValue: b[key],
            });
          }
        }
      } else {
        differences.push({
          path,
          type: "value_changed",
          oldValue: a,
          newValue: b,
        });
      }
    };

    compare(dataA, dataB);
    return differences;
  }

  private checkRetentionStatus(artifact: Artifact, versions: ArtifactVersion[]): string {
    if (artifact.status === "archived") {
      return "archived";
    }

    const versionCount = versions.length;
    if (versionCount > this.config.maxVersionsPerArtifact) {
      return "over_limit";
    }

    return "active";
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let versionControlInstance: ArtifactVersionControl | null = null;

export function getArtifactVersionControl(config?: VersionControlConfig): ArtifactVersionControl {
  if (!versionControlInstance) {
    if (!config) {
      throw new Error("VersionControl config is required for initialization");
    }
    versionControlInstance = new ArtifactVersionControl(config);
  }
  return versionControlInstance;
}

export function resetArtifactVersionControl(): void {
  versionControlInstance = null;
}

// Default export
export default ArtifactVersionControl;
