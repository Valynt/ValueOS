/**
 * Audit Log Service
 *
 * AUD-301: Immutable audit logging for compliance (SOC 2, GDPR)
 *
 * Features:
 * - Immutable logs (INSERT only, no UPDATE/DELETE)
 * - Cryptographic integrity (hash chain)
 * - Tenant isolation
 * - PII sanitization
 * - Compliance exports
 */

// Browser-compatible hash function (replaces Node.js crypto)
import { logger } from "../lib/logger.js";
import { sanitizeForLogging } from "../lib/piiFilter.js";
import { createServerSupabaseClient } from "../lib/supabase.js";
import { AuditLogEntry } from "../types";

import { BaseService } from "./BaseService.js";

export interface AuditLogCreateInput {
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  /** Snapshot of the resource state before the mutation. Stored in details.before_state. */
  beforeState?: Record<string, unknown>;
  /** Snapshot of the resource state after the mutation. Stored in details.after_state. */
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failed";
}

export interface AuditLogQuery {
  tenantId?: string;
  userId?: string;
  action?: string | string[];
  resourceType?: string | string[];
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  status?: "success" | "failed";
  limit?: number;
  offset?: number;
}

export interface AuditLogExportOptions {
  format: "csv" | "json";
  query?: AuditLogQuery;
}

export class AuditLogService extends BaseService {
  private lastHash: string | null = null;
  private initialized: boolean = false;
  private hashChainLock: Promise<void> = Promise.resolve();

  constructor() {
    super("AuditLogService");
    if (typeof window === "undefined") {
      try {
        this.supabase = createServerSupabaseClient();
      } catch (error) {
        logger.warn("Failed to initialize server Supabase client for audit logs", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Initialize hash chain from database
   * CRITICAL: Must be called before first audit log entry to maintain chain integrity
   */
  private async initializeHashChain(): Promise<void> {
    if (this.initialized) return;

    try {
      const { data } = await this.supabase
        .from("audit_logs" as any)
        .select("integrity_hash")
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      this.lastHash = data?.integrity_hash || null;
      this.initialized = true;

      logger.info("Audit hash chain initialized", {
        hasExistingChain: !!this.lastHash,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        "Failed to initialize audit hash chain",
        error instanceof Error ? error : undefined,
        { errorMsg }
      );
      this.initialized = true; // Prevent retry loops, start fresh chain
    }
  }

  /**
   * Convenience wrapper used by middleware hooks
   * Ensures all audit events persist through the immutable pipeline
   */
  async logAudit(input: AuditLogCreateInput): Promise<AuditLogEntry> {
    return this.createEntry(input);
  }

  /**
   * Resolve display name and email for a user ID.
   *
   * Uses the Supabase auth admin API (service_role) to look up the user.
   * Falls back to placeholder values if the lookup fails or the user ID is
   * not a valid UUID — this keeps audit logging non-fatal.
   */
  private async resolveActorIdentity(
    userId: string,
  ): Promise<{ userName: string; userEmail: string }> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !UUID_RE.test(userId)) {
      return { userName: userId || "system", userEmail: "" };
    }

    try {
      const { data, error } = await this.supabase.auth.admin.getUserById(userId);
      if (error || !data?.user) {
        return { userName: userId, userEmail: "" };
      }
      const user = data.user;
      const email = user.email ?? "";
      const name =
        (user.user_metadata?.["full_name"] as string | undefined) ??
        (user.user_metadata?.["name"] as string | undefined) ??
        email.split("@")[0] ??
        userId;
      return { userName: name, userEmail: email };
    } catch {
      // Non-fatal: audit log still written with userId as fallback
      return { userName: userId, userEmail: "" };
    }
  }

  /**
   * Log action routing events for ActionRouter
   */
  async logAction(input: {
    action_type: string;
    workspace_id?: string;
    user_id: string;
    session_id?: string;
    organization_id?: string;
    action_data: any;
    result_data: any;
    success: boolean;
    error_message?: string;
    duration_ms: number;
    timestamp: string;
    trace_id?: string;
  }): Promise<AuditLogEntry> {
    const { userName, userEmail } = await this.resolveActorIdentity(input.user_id);
    return this.logAudit({
      userId: input.user_id,
      userName,
      userEmail,
      action: `action_router:${input.action_type}`,
      resourceType: "action",
      resourceId: input.trace_id || "unknown",
      details: {
        workspace_id: input.workspace_id,
        session_id: input.session_id,
        organization_id: input.organization_id,
        action_data: input.action_data,
        result_data: input.result_data,
        success: input.success,
        error_message: input.error_message,
        duration_ms: input.duration_ms,
        timestamp: input.timestamp,
        trace_id: input.trace_id,
      },
      status: input.success ? "success" : "failed",
    });
  }

  /**
   * Create an audit log entry (immutable)
   * AUD-301: Logs are INSERT-only with cryptographic integrity
   */
  async createEntry(input: AuditLogCreateInput): Promise<AuditLogEntry> {
    this.validateRequired(input, [
      "userId",
      "userName",
      "userEmail",
      "action",
      "resourceType",
      "resourceId",
    ]);

    // Ensure hash chain is initialized before creating entries
    await this.initializeHashChain();

    // Use lock to serialize hash chain operations and prevent race conditions
    // This ensures each entry correctly references the previous hash
    return new Promise<AuditLogEntry>((resolve, reject) => {
      this.hashChainLock = this.hashChainLock.then(async () => {
        try {
          const result = await this.executeRequest(
            async () => {
              // Sanitize sensitive data
              const rawDetails: Record<string, unknown> = { ...input.details };
              if (input.beforeState !== undefined) rawDetails["before_state"] = input.beforeState;
              if (input.afterState !== undefined) rawDetails["after_state"] = input.afterState;
              const sanitizedDetails = sanitizeForLogging(rawDetails) as Record<string, unknown>;
              const { status: _ignoredStatus, ...detailsWithoutStatus } = sanitizedDetails;

              // Calculate integrity hash (using secure SHA-256)
              const hash = await this.calculateHash({
                userId: input.userId,
                action: input.action,
                resourceType: input.resourceType,
                resourceId: input.resourceId,
                details: detailsWithoutStatus,
                previousHash: this.lastHash,
              });

              const logEntry = {
                user_id: input.userId,
                user_name: input.userName,
                user_email: input.userEmail,
                action: input.action,
                resource_type: input.resourceType,
                resource_id: input.resourceId,
                details: detailsWithoutStatus,
                ip_address: input.ipAddress || "",
                user_agent: input.userAgent || "",
                status: input.status || "success",
                timestamp: new Date().toISOString(),
                integrity_hash: hash,
                previous_hash: this.lastHash || undefined,
              };

              const { data, error } = await this.supabase
                .from("audit_logs" as any)
                .insert(logEntry as any)
                .select()
                .single();

              if (error) {
                // CRITICAL: Audit logging failure must be escalated
                logger.error("CRITICAL: Audit logging failed", error, {
                  action: input.action,
                  resourceType: input.resourceType,
                });
                throw error;
              }

              this.lastHash = hash;
              return data as unknown as AuditLogEntry;
            },
            { skipCache: true }
          );
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Calculate cryptographic hash for integrity
   */
  private async calculateHash(data: any): Promise<string> {
    const content = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(content);
    // Use Web Crypto API for secure SHA-256 hash (browser-compatible)
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Query audit logs with filters.
   * tenantId is required to enforce tenant isolation.
   */
  async query(query: AuditLogQuery & { tenantId: string }): Promise<AuditLogEntry[]> {
    super.log("info", "Querying audit logs", query);

    if (!query.tenantId) {
      throw new Error("tenantId is required for audit log queries to enforce tenant isolation");
    }

    return this.executeRequest(
      async () => {
        let dbQuery = this.supabase.from("audit_logs" as any).select("*");

        // CRITICAL: Apply tenant filter first for security
        dbQuery = dbQuery.eq("tenant_id" as any, query.tenantId as any);

        if (query.userId) {
          dbQuery = dbQuery.eq("user_id" as any, query.userId as any);
        }

        if (query.action) {
          if (Array.isArray(query.action)) {
            dbQuery = dbQuery.in("action" as any, query.action);
          } else {
            dbQuery = dbQuery.eq("action" as any, query.action as any);
          }
        }

        if (query.resourceType) {
          if (Array.isArray(query.resourceType)) {
            dbQuery = dbQuery.in("resource_type" as any, query.resourceType);
          } else {
            dbQuery = dbQuery.eq("resource_type" as any, query.resourceType as any);
          }
        }

        if (query.resourceId) {
          dbQuery = dbQuery.eq("resource_id" as any, query.resourceId as any);
        }

        if (query.status) {
          dbQuery = dbQuery.eq("status" as any, query.status as any);
        }

        if (query.startDate) {
          dbQuery = dbQuery.gte("timestamp", query.startDate);
        }

        if (query.endDate) {
          dbQuery = dbQuery.lte("timestamp", query.endDate);
        }

        dbQuery = dbQuery.order("timestamp", { ascending: false });

        if (query.limit) {
          dbQuery = dbQuery.limit(query.limit);
        }

        if (query.offset) {
          dbQuery = dbQuery.range(query.offset, query.offset + (query.limit || 50) - 1);
        }

        const { data, error } = await dbQuery;

        if (error) throw error;
        return (data || []) as unknown as AuditLogEntry[];
      },
      {
        deduplicationKey: `audit-logs-${JSON.stringify(query)}`,
      }
    );
  }

  /**
   * Get audit log by ID
   */
  async getById(id: string): Promise<AuditLogEntry | null> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from("audit_logs" as any)
          .select("*")
          .eq("id" as any, id as any)
          .maybeSingle();

        if (error) throw error;
        return data as unknown as AuditLogEntry | null;
      },
      {
        deduplicationKey: `audit-log-${id}`,
      }
    );
  }

  /**
   * Export audit logs
   */
  async export(options: AuditLogExportOptions): Promise<string> {
    super.log("info", "Exporting audit logs", options);

    const logs = await this.query(options.query);

    if (options.format === "csv") {
      return this.exportToCsv(logs);
    } else {
      return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(
    startDate: string,
    endDate: string
  ): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; userName: string; count: number }>;
  }> {
    return this.executeRequest(
      async () => {
        const logs = await this.query({ startDate, endDate });

        const totalEvents = logs.length;
        const successfulEvents = logs.filter((l) => l.status === "success").length;
        const failedEvents = logs.filter((l) => l.status === "failed").length;

        const actionCounts = new Map<string, number>();
        logs.forEach((log) => {
          actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
        });

        const topActions = Array.from(actionCounts.entries())
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const userCounts = new Map<string, { userName: string; count: number }>();
        logs.forEach((log) => {
          const existing = userCounts.get(log.userId) || {
            userName: log.userName,
            count: 0,
          };
          userCounts.set(log.userId, {
            userName: log.userName,
            count: existing.count + 1,
          });
        });

        const topUsers = Array.from(userCounts.entries())
          .map(([userId, data]) => ({ userId, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        return {
          totalEvents,
          successfulEvents,
          failedEvents,
          topActions,
          topUsers,
        };
      },
      {
        deduplicationKey: `audit-stats-${startDate}-${endDate}`,
      }
    );
  }

  /**
   * Convert logs to CSV format
   */
  /**
   * Escape a CSV field value to prevent injection and handle special characters
   */
  private escapeCsvField(value: unknown): string {
    const str = String(value ?? "");
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private exportToCsv(logs: AuditLogEntry[]): string {
    const headers = [
      "ID",
      "Timestamp",
      "User",
      "Email",
      "Action",
      "Resource Type",
      "Resource ID",
      "Status",
      "IP Address",
    ];

    const rows = logs.map((log) => [
      this.escapeCsvField(log.id),
      this.escapeCsvField(log.timestamp),
      this.escapeCsvField(log.userName),
      this.escapeCsvField(log.userEmail),
      this.escapeCsvField(log.action),
      this.escapeCsvField(log.resourceType),
      this.escapeCsvField(log.resourceId),
      this.escapeCsvField(log.status),
      this.escapeCsvField(log.ipAddress),
    ]);

    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  }

  /**
   * Archive old audit logs (data retention)
   * AUD-301: Logs are immutable - archive instead of delete
   */
  async archiveOldLogs(olderThan: string): Promise<number> {
    logger.warn("Archiving old audit logs", { olderThan });

    return this.executeRequest(
      async () => {
        // Mark as archived instead of deleting
        const { data, error } = await this.supabase
          .from("audit_logs" as any)
          .update({ archived: true } as any)
          .lt("timestamp", olderThan)
          .select("id");

        if (error) throw error;

        const archivedCount = data?.length || 0;
        logger.info("Archived old audit logs", { count: archivedCount });

        this.clearCache();
        return archivedCount;
      },
      { skipCache: true }
    );
  }

  /**
   * Verify audit log integrity
   * AUD-301: Verify cryptographic hash chain
   */
  async verifyIntegrity(limit: number = 1000): Promise<{
    valid: boolean;
    errors: string[];
    checked: number;
  }> {
    logger.info("Verifying audit log integrity", { limit });

    const logs = await this.query({ limit });
    const errors: string[] = [];
    let previousHash: string | null = null;

    // Check in reverse chronological order
    for (let i = logs.length - 1; i >= 0; i--) {
      const log = logs[i] as any;

      // Verify hash chain
      if (log.previous_hash !== previousHash) {
        errors.push(
          `Hash chain broken at log ${log.id}: expected ${previousHash}, got ${log.previous_hash}`
        );
      }

      // Verify integrity hash (using secure SHA-256)
      const calculatedHash = await this.calculateHash({
        userId: log.user_id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        details: log.details,
        previousHash: log.previous_hash,
      });

      if (calculatedHash !== log.integrity_hash) {
        errors.push(
          `Integrity hash mismatch at log ${log.id}: expected ${log.integrity_hash}, got ${calculatedHash}`
        );
      }

      previousHash = log.integrity_hash || null;
    }

    const valid = errors.length === 0;

    if (!valid) {
      logger.error("Audit log integrity verification failed", undefined, {
        errors: errors.length,
        checked: logs.length,
      });
    } else {
      logger.info("Audit log integrity verified", {
        checked: logs.length,
      });
    }

    return {
      valid,
      errors,
      checked: logs.length,
    };
  }
}

export const auditLogService = new AuditLogService();
