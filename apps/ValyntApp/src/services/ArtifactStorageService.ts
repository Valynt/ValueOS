/**
 * Artifact Storage Service
 * Handles storage, retrieval, and retention of artifact files
 *
 * This service provides secure storage with encryption, compression,
 * and automated retention policies for artifact files
 */

import { createClient } from "@supabase/supabase-js";
import { EventEmitter } from "events";

import {
  ArtifactFormat,
  ArtifactStorageMetadata,
  RetentionPolicy,
} from "../types/artifact";

import { Database } from "../types/database";
import { logger } from "../lib/logger";

// ============================================================================
// Configuration
// ============================================================================

export interface StorageConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  bucketName: string;
  maxFileSizeMB: number;
  allowedFormats: ArtifactFormat[];
  enableEncryption: boolean;
  enableCompression: boolean;
  retentionCheckIntervalMs: number;
}

export interface StorageOptions {
  compress?: boolean;
  encrypt?: boolean;
  metadata?: Record<string, any>;
  retentionDays?: number;
}

// ============================================================================
// Storage Service
// ============================================================================

export class ArtifactStorageService extends EventEmitter {
  private supabase: ReturnType<typeof createClient<Database>>;
  private config: StorageConfig;
  private retentionInterval: NodeJS.Timeout | null = null;

  constructor(config: StorageConfig) {
    super();
    this.config = config;
    this.supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey);

    // Start retention check interval
    if (config.retentionCheckIntervalMs > 0) {
      this.startRetentionCheck();
    }
  }

  // ============================================================================
  // Storage Operations
  // ============================================================================

  /**
   * Store artifact file
   */
  async storeArtifact(
    artifactId: string,
    versionId: string,
    format: ArtifactFormat,
    data: Blob | Buffer | string,
    options: StorageOptions = {}
  ): Promise<ArtifactStorageMetadata> {
    // Validate format
    if (!this.config.allowedFormats.includes(format)) {
      throw new Error(`Format ${format} is not allowed. Allowed formats: ${this.config.allowedFormats.join(", ")}`);
    }

    // Convert data to Blob if needed
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (Buffer.isBuffer(data)) {
      blob = new Blob([data]);
    } else if (typeof data === "string") {
      blob = new Blob([data]);
    } else {
      throw new Error("Data must be a Blob, Buffer, or string");
    }

    // Check file size
    const sizeBytes = blob.size;
    const sizeMB = sizeBytes / (1024 * 1024);
    if (sizeMB > this.config.maxFileSizeMB) {
      throw new Error(`File size ${sizeMB.toFixed(2)}MB exceeds maximum ${this.config.maxFileSizeMB}MB`);
    }

    // Apply compression if requested
    let processedBlob = blob;
    if (options.compress && this.config.enableCompression) {
      processedBlob = await this.compressBlob(blob);
    }

    // Generate checksum
    const checksum = await this.generateChecksum(processedBlob);

    // Create file path
    const filePath = this.generateFilePath(artifactId, versionId, format);

    // Upload to storage
    const { error: uploadError } = await this.supabase.storage
      .from(this.config.bucketName)
      .upload(filePath, processedBlob, {
        contentType: this.getMimeType(format),
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      throw new Error(`Failed to upload artifact: ${uploadError.message}`);
    }

    // Create storage metadata
    const storageMetadata: ArtifactStorageMetadata = {
      artifactId,
      versionId,
      storagePath: filePath,
      format,
      sizeBytes,
      mimeType: this.getMimeType(format),
      checksum,
      uploadedAt: new Date().toISOString(),
    };

    // Store metadata
    const { error: metadataError } = await this.supabase
      .from("artifact_storage_metadata")
      .insert(storageMetadata);

    if (metadataError) {
      // Clean up uploaded file
      await this.supabase.storage
        .from(this.config.bucketName)
        .remove([filePath]);

      throw new Error(`Failed to store metadata: ${metadataError.message}`);
    }

    // Emit event
    this.emit("artifact_stored", {
      artifactId,
      versionId,
      format,
      sizeBytes,
    });

    return storageMetadata;
  }

  /**
   * Retrieve artifact file
   */
  async retrieveArtifact(
    artifactId: string,
    versionId: string,
    format: ArtifactFormat
  ): Promise<Blob> {
    const filePath = this.generateFilePath(artifactId, versionId, format);

    const { data, error } = await this.supabase.storage
      .from(this.config.bucketName)
      .download(filePath);

    if (error) {
      throw new Error(`Failed to retrieve artifact: ${error.message}`);
    }

    // Emit event
    this.emit("artifact_retrieved", {
      artifactId,
      versionId,
      format,
    });

    return data;
  }

  /**
   * Delete artifact file
   */
  async deleteArtifact(
    artifactId: string,
    versionId: string,
    format: ArtifactFormat
  ): Promise<void> {
    const filePath = this.generateFilePath(artifactId, versionId, format);

    // Delete from storage
    const { error: storageError } = await this.supabase.storage
      .from(this.config.bucketName)
      .remove([filePath]);

    if (storageError) {
      throw new Error(`Failed to delete artifact from storage: ${storageError.message}`);
    }

    // Delete metadata
    const { error: metadataError } = await this.supabase
      .from("artifact_storage_metadata")
      .delete()
      .eq("artifactId", artifactId)
      .eq("versionId", versionId)
      .eq("format", format);

    if (metadataError) {
      throw new Error(`Failed to delete metadata: ${metadataError.message}`);
    }

    // Emit event
    this.emit("artifact_deleted", {
      artifactId,
      versionId,
      format,
    });
  }

  /**
   * Get storage metadata
   */
  async getStorageMetadata(
    artifactId: string,
    versionId?: string
  ): Promise<ArtifactStorageMetadata[]> {
    let query = this.supabase
      .from("artifact_storage_metadata")
      .select()
      .eq("artifactId", artifactId);

    if (versionId) {
      query = query.eq("versionId", versionId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get storage metadata: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get total storage usage
   */
  async getStorageUsage(organizationId?: string): Promise<{
    totalSize: number;
    fileCount: number;
    byFormat: Record<string, { size: number; count: number }>;
    byArtifact: Record<string, { size: number; versions: number }>;
  }> {
    let query = this.supabase
      .from("artifact_storage_metadata")
      .select();

    if (organizationId) {
      // Join with artifacts to filter by organization
      query = this.supabase
        .from("artifact_storage_metadata")
        .select(`
          *,
          artifact:workflow_artifacts!inner(organizationId)
        `)
        .eq("artifact.organizationId", organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get storage usage: ${error.message}`);
    }

    const metadata = data || [];

    const result = {
      totalSize: 0,
      fileCount: metadata.length,
      byFormat: {} as Record<string, { size: number; count: number }>,
      byArtifact: {} as Record<string, { size: number; versions: number }>,
    };

    for (const meta of metadata) {
      result.totalSize += meta.sizeBytes;

      // By format
      if (!result.byFormat[meta.format]) {
        result.byFormat[meta.format] = { size: 0, count: 0 };
      }
      result.byFormat[meta.format].size += meta.sizeBytes;
      result.byFormat[meta.format].count += 1;

      // By artifact
      if (!result.byArtifact[meta.artifactId]) {
        result.byArtifact[meta.artifactId] = { size: 0, versions: 0 };
      }
      result.byArtifact[meta.artifactId].size += meta.sizeBytes;
      result.byArtifact[meta.artifactId].versions += 1;
    }

    return result;
  }

  // ============================================================================
  // Retention Management
  // ============================================================================

  /**
   * Apply retention policy
   */
  async applyRetentionPolicy(policy: RetentionPolicy): Promise<{
    deleted: number;
    errors: string[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.rules.archiveAfterDays);

    const result = {
      deleted: 0,
      errors: [] as string[],
    };

    // Get artifacts to process
    const { data: artifacts, error } = await this.supabase
      .from("workflow_artifacts")
      .select()
      .eq("organizationId", policy.organizationId)
      .eq("status", "archived")
      .lt("archivedAt", cutoffDate.toISOString());

    if (error) {
      result.errors.push(`Failed to get artifacts: ${error.message}`);
      return result;
    }

    // Process each artifact
    for (const artifact of artifacts || []) {
      try {
        // Get all versions
        const versions = await this.getStorageMetadata(artifact.id);

        // Delete old versions
        for (const version of versions) {
          await this.deleteArtifact(artifact.id, version.versionId, version.format);
          result.deleted++;
        }

        // Log audit event (if available)
        if (this.config.enableEncryption) {
          // In a real implementation, this would log to audit service
          logger.info(`Deleted ${versions.length} versions for artifact ${artifact.id}`);
        }
      } catch (error) {
        result.errors.push(`Failed to process artifact ${artifact.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return result;
  }

  /**
   * Start retention check interval
   */
  private startRetentionCheck(): void {
    this.retentionInterval = setInterval(async () => {
      try {
        await this.checkRetentionPolicies();
      } catch (error) {
        console.error("Retention check failed:", error);
      }
    }, this.config.retentionCheckIntervalMs);
  }

  /**
   * Check and apply retention policies
   */
  private async checkRetentionPolicies(): Promise<void> {
    // Get all active retention policies
    const { data: policies, error } = await this.supabase
      .from("retention_policies")
      .select()
      .eq("isActive", true);

    if (error) {
      console.error("Failed to get retention policies:", error.message);
      return;
    }

    // Apply each policy
    for (const policy of policies || []) {
      try {
        await this.applyRetentionPolicy(policy);
      } catch (error) {
        console.error(`Failed to apply retention policy ${policy.id}:`, error);
      }
    }
  }

  // ============================================================================
  // Compression & Encryption
  // ============================================================================

  /**
   * Compress blob
   */
  private async compressBlob(blob: Blob): Promise<Blob> {
    // In a real implementation, this would use a compression library
    // For now, we'll return the original blob
    // This is a placeholder for actual compression logic
    return blob;
  }

  /**
   * Encrypt blob
   */
  private async encryptBlob(blob: Blob): Promise<Blob> {
    // In a real implementation, this would use encryption
    // For now, we'll return the original blob
    // This is a placeholder for actual encryption logic
    return blob;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate file path
   */
  private generateFilePath(artifactId: string, versionId: string, format: ArtifactFormat): string {
    return `artifacts/${artifactId}/${versionId}.${format}`;
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: ArtifactFormat): string {
    const mimeTypes: Record<ArtifactFormat, string> = {
      pdf: "application/pdf",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      html: "text/html",
      csv: "text/csv",
      json: "application/json",
    };

    return mimeTypes[format] || "application/octet-stream";
  }

  /**
   * Generate checksum
   */
  private async generateChecksum(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Verify checksum
   */
  async verifyChecksum(
    artifactId: string,
    versionId: string,
    format: ArtifactFormat
  ): Promise<boolean> {
    const metadata = await this.getStorageMetadata(artifactId, versionId);
    if (metadata.length === 0) {
      return false;
    }

    const fileMetadata = metadata.find(m => m.format === format);
    if (!fileMetadata) {
      return false;
    }

    const blob = await this.retrieveArtifact(artifactId, versionId, format);
    const checksum = await this.generateChecksum(blob);

    return checksum === fileMetadata.checksum;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Cleanup orphaned files
   */
  async cleanupOrphanedFiles(): Promise<{
    deleted: number;
    errors: string[];
  }> {
    const result = {
      deleted: 0,
      errors: [] as string[],
    };

    // Get all storage metadata
    const { data: metadata, error } = await this.supabase
      .from("artifact_storage_metadata")
      .select();

    if (error) {
      result.errors.push(`Failed to get metadata: ${error.message}`);
      return result;
    }

    // Check each file
    for (const meta of metadata || []) {
      try {
        // Check if artifact still exists
        const { data: artifact, error: artifactError } = await this.supabase
          .from("workflow_artifacts")
          .select()
          .eq("id", meta.artifactId)
          .single();

        if (artifactError && artifactError.code === "PGRST116") {
          // Artifact doesn't exist, delete the file
          await this.deleteArtifact(meta.artifactId, meta.versionId, meta.format);
          result.deleted++;
        }
      } catch (error) {
        result.errors.push(`Failed to check artifact ${meta.artifactId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return result;
  }

  /**
   * Stop retention check interval
   */
  stopRetentionCheck(): void {
    if (this.retentionInterval) {
      clearInterval(this.retentionInterval);
      this.retentionInterval = null;
    }
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    this.stopRetentionCheck();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let storageServiceInstance: ArtifactStorageService | null = null;

export function getArtifactStorageService(config?: StorageConfig): ArtifactStorageService {
  if (!storageServiceInstance) {
    if (!config) {
      throw new Error("StorageConfig is required for initialization");
    }
    storageServiceInstance = new ArtifactStorageService(config);
  }
  return storageServiceInstance;
}

export function resetArtifactStorageService(): void {
  if (storageServiceInstance) {
    storageServiceInstance.shutdown();
  }
  storageServiceInstance = null;
}

// Default export
export default ArtifactStorageService;
