import { z } from "zod";

import { createLogger } from "../../lib/logger.js";
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from "../../lib/supabase.js";
import { getCrmSyncQueue, getCrmWebhookQueue } from "../../workers/crmWorker.js";
import { auditLogService } from "../security/AuditLogService.js";

import type { CrmProvider } from "./types.js";

const logger = createLogger({ component: "IntegrationOperationsService" });

const providerSchema = z.enum(["hubspot", "salesforce"]);

export interface IntegrationOperationEntry {
  id: string;
  provider: CrmProvider;
  category: "connection_event" | "webhook_failure" | "sync_failure";
  action: string;
  status: "success" | "failed";
  timestamp: string;
  correlationId: string | null;
  details: Record<string, unknown>;
}

export interface IntegrationOperationsResponse {
  tenantId: string;
  generatedAt: string;
  provider: CrmProvider | "all";
  connectionEvents: IntegrationOperationEntry[];
  webhookFailures: IntegrationOperationEntry[];
  syncFailures: IntegrationOperationEntry[];
  lifecycleHistory: IntegrationOperationEntry[];
}

function toProvider(value: unknown): CrmProvider | null {
  const parsed = providerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function extractCorrelationId(details: Record<string, unknown> | null | undefined): string | null {
  if (!details) return null;

  const direct = details.correlationId;
  if (typeof direct === "string" && direct.length > 0) return direct;

  const trace = details.traceId;
  if (typeof trace === "string" && trace.length > 0) return trace;

  const requiredContract = details.required_contract;
  if (requiredContract && typeof requiredContract === "object") {
    const nested = (requiredContract as Record<string, unknown>).correlation_id;
    if (typeof nested === "string" && nested.length > 0) return nested;
  }

  return null;
}

export class IntegrationOperationsService {
  private supabase = createServerSupabaseClient();

  async getOperations(tenantId: string, provider?: CrmProvider, limit = 25): Promise<IntegrationOperationsResponse> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const actionFilters = [
      "integration_connected",
      "integration_disconnected",
      "crm_connect_started",
      "crm_connect_completed",
      "crm_disconnected",
      "crm_token_refresh_failed",
      "crm_sync_failed",
      "webhook_signature_rejected",
    ];

    const auditEntries = await auditLogService.query({
      tenantId,
      action: actionFilters,
      limit: 500,
    });

    const auditMapped = auditEntries
      .map((entry) => {
        const details = entry.details ?? {};
        const eventProvider = toProvider(details.provider) ?? toProvider(entry.resource_id);
        if (provider && eventProvider !== provider) return null;

        const category: IntegrationOperationEntry["category"] =
          entry.action === "crm_sync_failed"
            ? "sync_failure"
            : entry.action.includes("webhook")
              ? "webhook_failure"
              : "connection_event";

        return {
          id: entry.id,
          provider: eventProvider ?? (provider ?? "hubspot"),
          category,
          action: entry.action,
          status: entry.status,
          timestamp: entry.timestamp,
          correlationId: extractCorrelationId(details),
          details,
        } satisfies IntegrationOperationEntry;
      })
      .filter((entry): entry is IntegrationOperationEntry => entry !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const webhookFailures = await this.getWebhookFailures(tenantId, provider, boundedLimit);

    const syncFailures = auditMapped
      .filter((entry) => entry.category === "sync_failure" || entry.status === "failed")
      .slice(0, boundedLimit);

    const connectionEvents = auditMapped
      .filter((entry) => entry.category === "connection_event")
      .slice(0, boundedLimit);

    const lifecycleHistory = auditMapped
      .filter((entry) =>
        ["integration_connected", "integration_disconnected", "crm_disconnected", "crm_token_refresh_failed"].includes(entry.action)
      )
      .slice(0, boundedLimit);

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      provider: provider ?? "all",
      connectionEvents,
      webhookFailures,
      syncFailures,
      lifecycleHistory,
    };
  }

  async replayWebhookFailure(tenantId: string, eventId: string): Promise<{ eventId: string; jobId: string | null }> {
    const { data, error } = await this.supabase
      .from("crm_webhook_events")
      .select("id, tenant_id, provider, process_status")
      .eq("id", eventId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !data) {
      throw new Error("Webhook failure record not found");
    }

    const provider = toProvider(data.provider);
    if (!provider) {
      throw new Error("Webhook failure provider is invalid");
    }

    await this.supabase
      .from("crm_webhook_events")
      .update({
        process_status: "pending",
        processed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("tenant_id", tenantId);

    const queue = getCrmWebhookQueue();
    const job = await queue.add(
      "crm:webhook:replay",
      {
        eventId,
        tenantId,
        provider,
        traceId: `replay:${eventId}`,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
      }
    );

    return { eventId, jobId: job.id ? String(job.id) : null };
  }

  async retrySync(tenantId: string, provider: CrmProvider): Promise<{ provider: CrmProvider; jobId: string | null }> {
    const queue = getCrmSyncQueue();
    const job = await queue.add(
      "crm:sync:retry",
      {
        tenantId,
        provider,
        type: "delta",
        traceId: `retry-sync:${provider}:${Date.now()}`,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }
    );

    return { provider, jobId: job.id ? String(job.id) : null };
  }

  private async getWebhookFailures(tenantId: string, provider: CrmProvider | undefined, limit: number): Promise<IntegrationOperationEntry[]> {
    let query = this.supabase
      .from("crm_webhook_events")
      .select("id, provider, process_status, event_type, last_error, created_at")
      .eq("tenant_id", tenantId)
      .eq("process_status", "failed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (provider) {
      query = query.eq("provider", provider);
    }

    const { data, error } = await query;
    if (error) {
      logger.warn("Failed to load webhook failures", { tenantId, provider, error: error.message });
      return [];
    }

    return (data ?? [])
      .map((row) => {
        const mappedProvider = toProvider(row.provider);
        if (!mappedProvider) return null;

        const details: Record<string, unknown> = {
          eventType: row.event_type,
          lastError: row.last_error,
          processStatus: row.process_status,
        };

        return {
          id: String(row.id),
          provider: mappedProvider,
          category: "webhook_failure",
          action: "crm_webhook_failed",
          status: "failed",
          timestamp: String(row.created_at),
          correlationId: `webhook:${String(row.id)}`,
          details,
        } satisfies IntegrationOperationEntry;
      })
      .filter((row): row is IntegrationOperationEntry => row !== null);
  }
}

export const integrationOperationsService = new IntegrationOperationsService();
