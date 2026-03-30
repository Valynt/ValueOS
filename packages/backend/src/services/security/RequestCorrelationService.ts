/**
 * RequestCorrelationService
 *
 * Provides end-to-end request tracing and log correlation (S2-2, S2-3).
 * Enables querying all logs related to a specific request ID across
 * audit_logs, security_audit_log, and reasoning_traces.
 *
 * Features:
 * - Correlation query: request ID → all related logs
 * - Tenant-scoped results
 * - Compliance export with integrity verification
 */

import { createHash } from "crypto";

import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

export interface CorrelatedLog {
  source: "audit_logs" | "security_audit_log" | "reasoning_traces" | "agent_executions";
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata: Record<string, unknown>;
  integrity_hash?: string;
}

export interface CorrelationQueryResult {
  requestId: string;
  tenantId: string;
  totalLogs: number;
  logs: CorrelatedLog[];
  integrityHash: string;
  generatedAt: string;
}

export interface ComplianceExportOptions {
  format: "json" | "csv";
  tenantId: string;
  requestId?: string;
  startDate?: string;
  endDate?: string;
  includeIntegrityHash?: boolean;
}

export class RequestCorrelationService {
  /**
   * Query all logs correlated by request ID (S2-2).
   * Searches across audit_logs, security_audit_log, and reasoning_traces.
   *
   * @param requestId - The request ID to correlate
   * @param tenantId - Tenant scope for security
   * @returns All correlated logs ordered by timestamp
   */
  async queryByRequestId(
    requestId: string,
    tenantId: string
  ): Promise<CorrelationQueryResult> {
    const logs: CorrelatedLog[] = [];

    // Query audit_logs
    const { data: auditLogs, error: auditError } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`request_id.eq.${requestId},correlation_id.eq.${requestId},metadata->>requestId.eq.${requestId}`)
      .order("timestamp", { ascending: true });

    if (auditError) {
      logger.error("RequestCorrelation: audit_logs query failed", {
        error: auditError.message,
        requestId,
        tenantId,
      });
    } else if (auditLogs) {
      logs.push(
        ...auditLogs.map((log) => ({
          source: "audit_logs" as const,
          timestamp: log.timestamp,
          level: log.status === "failed" ? ("error" as const) : ("info" as const),
          message: `${log.action} on ${log.resource_type}:${log.resource_id}`,
          metadata: {
            userId: log.user_id,
            action: log.action,
            resourceType: log.resource_type,
            resourceId: log.resource_id,
            details: log.details,
          },
          integrity_hash: log.integrity_hash,
        }))
      );
    }

    // Query security_audit_log
    const { data: securityLogs, error: securityError } = await supabase
      .from("security_audit_log")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`request_id.eq.${requestId},correlation_id.eq.${requestId},metadata->>requestId.eq.${requestId}`)
      .order("timestamp", { ascending: true });

    if (securityError) {
      logger.error("RequestCorrelation: security_audit_log query failed", {
        error: securityError.message,
        requestId,
        tenantId,
      });
    } else if (securityLogs) {
      logs.push(
        ...securityLogs.map((log) => ({
          source: "security_audit_log" as const,
          timestamp: log.timestamp,
          level: log.severity as "info" | "warn" | "error" | "debug",
          message: log.event_type,
          metadata: {
            eventType: log.event_type,
            actor: log.actor,
            details: log.details,
          },
          integrity_hash: log.integrity_hash,
        }))
      );
    }

    // Query reasoning_traces via trace_id correlation
    const { data: traces, error: traceError } = await supabase
      .from("reasoning_traces")
      .select("*")
      .eq("organization_id", tenantId)
      .eq("trace_id", requestId)
      .order("created_at", { ascending: true });

    if (traceError) {
      logger.error("RequestCorrelation: reasoning_traces query failed", {
        error: traceError.message,
        requestId,
        tenantId,
      });
    } else if (traces) {
      logs.push(
        ...traces.map((trace) => ({
          source: "reasoning_traces" as const,
          timestamp: trace.created_at,
          level: "info" as const,
          message: `Agent ${trace.agent_name} execution`,
          metadata: {
            agentName: trace.agent_name,
            agentVersion: trace.agent_version,
            sessionId: trace.session_id,
            valueCaseId: trace.value_case_id,
            groundingScore: trace.grounding_score,
            evidenceLinks: trace.evidence_links,
          },
        }))
      );
    }

    // Sort all logs by timestamp
    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Calculate integrity hash
    const integrityHash = this.calculateIntegrityHash(logs);

    return {
      requestId,
      tenantId,
      totalLogs: logs.length,
      logs,
      integrityHash,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate compliance export with integrity verification (S2-3).
   * Exports audit trail in JSON or CSV format with verifiable integrity hash.
   *
   * @param options - Export options including format and filters
   * @returns Export data with integrity hash
   */
  async generateComplianceExport(
    options: ComplianceExportOptions
  ): Promise<{ data: string; integrityHash: string; filename: string }> {
    const { format, tenantId, requestId, startDate, endDate, includeIntegrityHash = true } = options;

    // Build base query
    let query = supabase
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("timestamp", { ascending: true });

    if (requestId) {
      query = query.or(`request_id.eq.${requestId},correlation_id.eq.${requestId}`);
    }

    if (startDate) {
      query = query.gte("timestamp", startDate);
    }

    if (endDate) {
      query = query.lte("timestamp", endDate);
    }

    const { data: logs, error } = await query;

    if (error) {
      logger.error("RequestCorrelation: compliance export failed", {
        error: error.message,
        tenantId,
        requestId,
      });
      throw new Error(`Compliance export failed: ${error.message}`);
    }

    const integrityHash = includeIntegrityHash
      ? this.calculateIntegrityHash(logs || [])
      : "";

    if (format === "json") {
      const exportData = {
        export_metadata: {
          generated_at: new Date().toISOString(),
          tenant_id: tenantId,
          request_id: requestId,
          date_range: { start: startDate, end: endDate },
          record_count: logs?.length || 0,
          integrity_hash: integrityHash,
        },
        logs: logs || [],
      };

      return {
        data: JSON.stringify(exportData, null, 2),
        integrityHash,
        filename: `audit-export-${tenantId}-${new Date().toISOString().split("T")[0]}.json`,
      };
    } else {
      // CSV format
      const headers = [
        "timestamp",
        "action",
        "user_id",
        "resource_type",
        "resource_id",
        "status",
        "integrity_hash",
      ];
      const rows = (logs || []).map((log) => [
        log.timestamp,
        log.action,
        log.user_id,
        log.resource_type,
        log.resource_id,
        log.status,
        log.integrity_hash || "",
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      return {
        data: csv,
        integrityHash,
        filename: `audit-export-${tenantId}-${new Date().toISOString().split("T")[0]}.csv`,
      };
    }
  }

  /**
   * Verify integrity of exported logs (S2-3).
   * Re-calculates hash and compares with stored integrity hash.
   *
   * @param logs - The exported logs to verify
   * @param expectedHash - The expected integrity hash
   * @returns True if integrity is verified
   */
  verifyIntegrity(logs: CorrelatedLog[] | unknown[], expectedHash: string): boolean {
    const calculatedHash = this.calculateIntegrityHash(logs);
    return calculatedHash === expectedHash;
  }

  /**
   * Calculate SHA-256 integrity hash for logs (S2-3).
   * Uses canonical JSON serialization with sorted keys for deterministic hashing.
   */
  private calculateIntegrityHash(logs: Record<string, unknown>): string {
    const canonicalJson = JSON.stringify(logs, (key, value) => {
      // Sort object keys for deterministic serialization
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return Object.keys(value).sort().reduce((sorted, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {} as Record<string, unknown>);
      }
      return value;
    });
    return createHash("sha256").update(canonicalJson).digest("hex");
  }
}

export const requestCorrelationService = new RequestCorrelationService();
