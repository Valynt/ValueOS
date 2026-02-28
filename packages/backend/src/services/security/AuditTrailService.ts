/**
 * Audit Trail Persistence Service
 *
 * Persists security audit events to the database for compliance and forensics.
 * Replaces in-memory audit trail storage in AgentSecurityService.
 */

import { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js"
import { getSupabaseClient } from "../../lib/supabase.js"

// ============================================================================
// Types
// ============================================================================

export interface AuditEvent {
  id?: string;
  eventType: AuditEventType;
  actorId: string;
  externalSub: string;
  actorType: ActorType;
  resourceId: string;
  resourceType: ResourceType;
  action: string;
  outcome: AuditOutcome;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
  sessionId: string;
  correlationId: string;
  riskScore: number;
  complianceFlags: string[];
  tenantId?: string;
}

export type AuditEventType =
  | "authentication"
  | "authorization"
  | "data_access"
  | "configuration_change"
  | "security_event"
  | "compliance_violation"
  | "permission_change"
  | "role_change"
  | "saga_compensation"
  | "integrity_veto"
  | "saga_compensation_executed"
  | "saga_compensation_failed"
  | "saga_opportunity_target_compensation"
  | "dlq_alert";

export type ActorType = "user" | "agent" | "system" | "service";
export type ResourceType =
  | "agent"
  | "data"
  | "configuration"
  | "policy"
  | "user"
  | "system"
  | "permission"
  | "role"
  | "integrity_issue"
  | "case"
  | "message_queue";
export type AuditOutcome = "success" | "failure" | "denied" | "error";

export interface AuditQueryFilters {
  eventType?: AuditEventType;
  actorId?: string;
  externalSub?: string;
  actorType?: ActorType;
  resourceType?: ResourceType;
  outcome?: AuditOutcome;
  tenantId?: string;
  timeRange?: { start: number; end: number };
  correlationId?: string;
  minRiskScore?: number;
  complianceFlag?: string;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Audit Trail Service
// ============================================================================

export class AuditTrailService {
  private supabase: SupabaseClient;
  private readonly tableName = "security_audit_log";
  private writeBuffer: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly bufferSize: number;
  private readonly flushIntervalMs: number;

  constructor(options: { bufferSize?: number; flushIntervalMs?: number } = {}) {
    this.supabase = getSupabaseClient();
    this.bufferSize = options.bufferSize || 100;
    this.flushIntervalMs = options.flushIntervalMs || 5000;

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Log an audit event
   * Events are buffered and flushed periodically for performance
   */
  async log(event: Omit<AuditEvent, "id">): Promise<void> {
    this.writeBuffer.push(event as AuditEvent);

    // Flush if buffer is full
    if (this.writeBuffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Log an audit event immediately (bypasses buffer)
   * Use for critical security events
   */
  async logImmediate(event: Omit<AuditEvent, "id">): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(this.mapEventToRow(event))
        .select("id")
        .single();

      if (error) {
        logger.error("Failed to log audit event", error);
        // Fall back to buffer
        this.writeBuffer.push(event as AuditEvent);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      logger.error(
        "Audit log error",
        error instanceof Error ? error : undefined
      );
      this.writeBuffer.push(event as AuditEvent);
      return null;
    }
  }

  /**
   * Flush buffered events to database
   */
  async flush(): Promise<void> {
    if (this.writeBuffer.length === 0) return;

    const eventsToFlush = [...this.writeBuffer];
    this.writeBuffer = [];

    try {
      const rows = eventsToFlush.map((e) => this.mapEventToRow(e));

      const { error } = await this.supabase.from(this.tableName).insert(rows);

      if (error) {
        logger.error("Failed to flush audit events", error, {
          count: eventsToFlush.length,
        });
        // Re-add failed events to buffer (with limit to prevent memory issues)
        if (this.writeBuffer.length < this.bufferSize * 2) {
          this.writeBuffer.push(...eventsToFlush);
        }
      } else {
        logger.debug("Flushed audit events", { count: eventsToFlush.length });
      }
    } catch (error) {
      logger.error(
        "Audit flush error",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Query audit events
   */
  async query(filters: AuditQueryFilters = {}): Promise<AuditQueryResult> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select("*", { count: "exact" });

      // Apply filters
      if (filters.eventType) {
        query = query.eq("event_type", filters.eventType);
      }
      if (filters.actorId) {
        query = query.eq("actor_id", filters.actorId);
      }
      if (filters.externalSub) {
        // DB column is still named auth0_sub (legacy); TS field renamed to externalSub
        query = query.eq("auth0_sub", filters.externalSub);
      }
      if (filters.actorType) {
        query = query.eq("actor_type", filters.actorType);
      }
      if (filters.resourceType) {
        query = query.eq("resource_type", filters.resourceType);
      }
      if (filters.outcome) {
        query = query.eq("outcome", filters.outcome);
      }
      if (filters.tenantId) {
        query = query.eq("tenant_id", filters.tenantId);
      }
      if (filters.correlationId) {
        query = query.eq("correlation_id", filters.correlationId);
      }
      if (filters.minRiskScore !== undefined) {
        query = query.gte("risk_score", filters.minRiskScore);
      }
      if (filters.complianceFlag) {
        query = query.contains("compliance_flags", [filters.complianceFlag]);
      }
      if (filters.timeRange) {
        query = query
          .gte("timestamp", filters.timeRange.start)
          .lte("timestamp", filters.timeRange.end);
      }

      // Ordering and pagination
      query = query.order("timestamp", { ascending: false });

      const limit = filters.limit || 100;
      const offset = filters.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error("Failed to query audit events", error);
        throw error;
      }

      const events = (data || []).map((row) => this.mapRowToEvent(row));
      const total = count || 0;

      return {
        events,
        total,
        hasMore: offset + events.length < total,
      };
    } catch (error) {
      logger.error(
        "Audit query error",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Get audit events by correlation ID
   * Useful for tracing related events
   */
  async getByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    const result = await this.query({ correlationId, limit: 1000 });
    return result.events;
  }

  /**
   * Get recent security events
   */
  async getRecentSecurityEvents(
    tenantId: string,
    hours: number = 24,
    limit: number = 100
  ): Promise<AuditEvent[]> {
    const now = Date.now();
    const start = now - hours * 60 * 60 * 1000;

    const result = await this.query({
      tenantId,
      eventType: "security_event",
      timeRange: { start, end: now },
      limit,
    });

    return result.events;
  }

  /**
   * Get failed authorization attempts
   */
  async getFailedAuthorizations(
    tenantId: string,
    hours: number = 24
  ): Promise<AuditEvent[]> {
    const now = Date.now();
    const start = now - hours * 60 * 60 * 1000;

    const result = await this.query({
      tenantId,
      eventType: "authorization",
      outcome: "denied",
      timeRange: { start, end: now },
      limit: 500,
    });

    return result.events;
  }

  /**
   * Get high-risk events
   */
  async getHighRiskEvents(
    tenantId: string,
    minRiskScore: number = 0.7
  ): Promise<AuditEvent[]> {
    const result = await this.query({
      tenantId,
      minRiskScore,
      limit: 500,
    });

    return result.events;
  }

  /**
   * Export audit events for compliance reporting
   */
  async exportForCompliance(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditEvent[]> {
    const result = await this.query({
      tenantId,
      timeRange: {
        start: startDate.getTime(),
        end: endDate.getTime(),
      },
      limit: 10000, // Large limit for exports
    });

    return result.events;
  }

  /**
   * Clean up old audit events (retention policy)
   */
  async cleanupOldEvents(retentionDays: number = 2555): Promise<number> {
    const cutoffDate = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lt("timestamp", cutoffDate)
        .select("id");

      if (error) {
        logger.error("Failed to cleanup old audit events", error);
        return 0;
      }

      const count = data?.length || 0;
      logger.info("Cleaned up old audit events", { count, retentionDays });
      return count;
    } catch (error) {
      logger.error(
        "Audit cleanup error",
        error instanceof Error ? error : undefined
      );
      return 0;
    }
  }

  /**
   * Stop the service and flush remaining events
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch((err) => {
        logger.error(
          "Periodic flush failed",
          err instanceof Error ? err : undefined
        );
      });
    }, this.flushIntervalMs);
  }

  private mapEventToRow(
    event: Omit<AuditEvent, "id">
  ): Record<string, unknown> {
    return {
      event_type: event.eventType,
      actor_id: event.actorId,
      auth0_sub: event.externalSub, // DB column is auth0_sub (legacy)
      actor_type: event.actorType,
      resource_id: event.resourceId,
      resource_type: event.resourceType,
      action: event.action,
      outcome: event.outcome,
      details: event.details,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      timestamp: event.timestamp,
      session_id: event.sessionId,
      correlation_id: event.correlationId,
      risk_score: event.riskScore,
      compliance_flags: event.complianceFlags,
      tenant_id: event.tenantId,
    };
  }

  private mapRowToEvent(row: Record<string, unknown>): AuditEvent {
    return {
      id: row.id as string,
      eventType: row.event_type as AuditEventType,
      actorId: row.actor_id as string,
      externalSub: row.auth0_sub as string, // DB column is auth0_sub (legacy)
      actorType: row.actor_type as ActorType,
      resourceId: row.resource_id as string,
      resourceType: row.resource_type as ResourceType,
      action: row.action as string,
      outcome: row.outcome as AuditOutcome,
      details: row.details as Record<string, unknown>,
      ipAddress: row.ip_address as string,
      userAgent: row.user_agent as string,
      timestamp: row.timestamp as number,
      sessionId: row.session_id as string,
      correlationId: row.correlation_id as string,
      riskScore: row.risk_score as number,
      complianceFlags: row.compliance_flags as string[],
      tenantId: row.tenant_id as string | undefined,
    };
  }
}

// Singleton instance
let auditTrailServiceInstance: AuditTrailService | null = null;

/**
 * Get the audit trail service instance
 */
export function getAuditTrailService(): AuditTrailService {
  if (!auditTrailServiceInstance) {
    auditTrailServiceInstance = new AuditTrailService();
  }
  return auditTrailServiceInstance;
}

export default getAuditTrailService;
