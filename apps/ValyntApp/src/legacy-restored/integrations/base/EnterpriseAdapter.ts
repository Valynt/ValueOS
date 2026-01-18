/**
 * Base Enterprise Adapter
 * Abstract base class providing common functionality for all adapters
 */

import type {
  IEnterpriseAdapter,
  AdapterConfig,
  AdapterMetrics,
  HealthStatus,
  SyncOptions,
  SyncResult,
} from "./IEnterpriseAdapter";
import { RateLimiter } from "./RateLimiter";
import { enhancedAuditLogger } from "../../lib/audit/EnhancedAuditLogger";
import { createClient } from "@supabase/supabase-js";

export abstract class EnterpriseAdapter implements IEnterpriseAdapter {
  abstract readonly adapterType: string;
  abstract readonly displayName: string;

  protected rateLimiter: RateLimiter;
  protected config: AdapterConfig;
  protected authenticated: boolean = false;
  protected metrics: AdapterMetrics;
  protected supabase: ReturnType<typeof createClient>;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    this.rateLimiter = new RateLimiter({
      adapterId: `${this.adapterType}:${config.connectionId}`,
      maxRequests: config.rateLimits.maxRequestsPerSecond,
      windowMs: 1000,
      burstAllowance: config.rateLimits.burstAllowance,
    });

    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      avgSyncDuration: 0,
      apiCallsToday: 0,
      rateLimitUtilization: 0,
    };
  }

  // Abstract methods that must be implemented by concrete adapters
  abstract authenticate(): Promise<void>;
  abstract refreshToken(): Promise<void>;
  protected abstract performSync(
    direction: "pull" | "push" | "bidirectional",
    options?: SyncOptions
  ): Promise<SyncResult>;

  // CRUD operations - must be implemented
  abstract create(entityType: string, data: any): Promise<any>;
  abstract read(entityType: string, id: string): Promise<any>;
  abstract update(entityType: string, id: string, data: any): Promise<any>;
  abstract delete(entityType: string, id: string): Promise<void>;
  abstract query(entityType: string, filters: any): Promise<any[]>;

  /**
   * Check if adapter is authenticated
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * Sync with rate limiting and audit logging
   */
  async sync(
    direction: "pull" | "push" | "bidirectional",
    options?: SyncOptions
  ): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Ensure authenticated
      if (!this.authenticated) {
        await this.authenticate();
      }

      // Rate limiting
      await this.rateLimiter.acquire();

      // Perform sync
      const result = await this.performSync(direction, options);

      // Update metrics
      this.metrics.totalSyncs++;
      if (result.status === "success") {
        this.metrics.successfulSyncs++;
      } else {
        this.metrics.failedSyncs++;
      }

      const duration = Date.now() - startTime;
      this.metrics.avgSyncDuration =
        (this.metrics.avgSyncDuration * (this.metrics.totalSyncs - 1) +
          duration) /
        this.metrics.totalSyncs;

      // Audit logging
      await this.logAuditEvent("sync", {
        direction,
        status: result.status,
        pullCount: result.pullCount,
        pushCount: result.pushCount,
        conflicts: result.conflicts.length,
        duration,
      });

      // Save sync history
      await this.saveSyncHistory(direction, result, startTime, Date.now());

      return result;
    } catch (error) {
      this.metrics.failedSyncs++;

      await this.logAuditEvent("sync_error", {
        direction,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }

  /**
   * Batch create with rate limiting
   */
  async batchCreate(entityType: string, data: any[]): Promise<any[]> {
    const results: any[] = [];
    const batchSize = this.config.syncConfig.batchSize || 50;

    for (let i = 0; i < data.length; i += batchSize) {
      await this.rateLimiter.acquire();
      const batch = data.slice(i, i + batchSize);
      const batchResults = await this.performBatchCreate(entityType, batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Batch update with rate limiting
   */
  async batchUpdate(
    entityType: string,
    updates: Array<{ id: string; data: any }>
  ): Promise<any[]> {
    const results: any[] = [];
    const batchSize = this.config.syncConfig.batchSize || 50;

    for (let i = 0; i < updates.length; i += batchSize) {
      await this.rateLimiter.acquire();
      const batch = updates.slice(i, i + batchSize);
      const batchResults = await this.performBatchUpdate(entityType, batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const rateLimitStatus = await this.rateLimiter.check();

      return {
        healthy: this.authenticated,
        lastCheck: new Date(),
        details: {
          authenticated: this.authenticated,
          rateLimitRemaining: rateLimitStatus.available,
          lastSyncTime: await this.getLastSyncTime(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        lastCheck: new Date(),
        details: {
          authenticated: this.authenticated,
          rateLimitRemaining: 0,
          errors: [
            error instanceof Error ? error.message : "Health check failed",
          ],
        },
      };
    }
  }

  /**
   * Get adapter metrics
   */
  getMetrics(): AdapterMetrics {
    return { ...this.metrics };
  }

  /**
   * Disconnect adapter
   */
  async disconnect(): Promise<void> {
    this.authenticated = false;
  }

  /**
   * Protected helpers for concrete adapters
   */
  protected async performBatchCreate(
    entityType: string,
    data: any[]
  ): Promise<any[]> {
    // Default implementation: sequential creates
    const results: any[] = [];
    for (const item of data) {
      results.push(await this.create(entityType, item));
    }
    return results;
  }

  protected async performBatchUpdate(
    entityType: string,
    updates: Array<{ id: string; data: any }>
  ): Promise<any[]> {
    // Default implementation: sequential updates
    const results: any[] = [];
    for (const update of updates) {
      results.push(await this.update(entityType, update.id, update.data));
    }
    return results;
  }

  protected async logAuditEvent(action: string, metadata: any): Promise<void> {
    await enhancedAuditLogger.logEvent({
      category: "integration",
      action: `${this.adapterType}_${action}`,
      actor: {
        id: this.config.connectionId,
        role: "integration_adapter",
        organizationId: this.config.organizationId,
        auditToken: "",
      },
      resource: {
        type: "integration",
        id: this.config.connectionId,
      },
      result: "success",
      severity: "info",
      metadata,
    });
  }

  protected async saveSyncHistory(
    direction: string,
    result: SyncResult,
    startTime: number,
    endTime: number
  ): Promise<void> {
    await this.supabase.from("sync_history").insert({
      connection_id: this.config.connectionId,
      sync_direction: direction,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date(endTime).toISOString(),
      records_processed: result.pullCount + result.pushCount,
      records_created: result.pullCount,
      records_updated: result.pushCount,
      records_failed: result.errors.length,
      status: result.status,
      metadata: {
        conflicts: result.conflicts.length,
        errors: result.errors,
      },
    });
  }

  protected async getLastSyncTime(): Promise<Date | undefined> {
    const { data } = await this.supabase
      .from("sync_history")
      .select("completed_at")
      .eq("connection_id", this.config.connectionId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();

    return data ? new Date(data.completed_at) : undefined;
  }
}

export default EnterpriseAdapter;
